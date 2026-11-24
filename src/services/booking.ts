// Booking rules: timed seat holds and purchases.
//
// Every state change runs inside one lock and re-reads the latest state
// first, so "check the seat is free" and "mark it held" are a single atomic
// step. Two customers clicking the same seat at the same instant are
// serialised; the second one sees the first one's hold and is refused.
// (With a database this is a transaction / conditional UPDATE - same rule.)

import { readJSON, type KV, type LockFn } from './infra'
import { TicketAuthority, type Ticket } from './tickets'

export interface Hold {
  holder: string
  expiresAt: number
}

export interface BookingState {
  holds: Record<string, Hold>
  /** seatId -> ticketId */
  sold: Record<string, string>
}

export type HoldResult =
  | { ok: true; seatId: string; expiresAt: number }
  | { ok: false; reason: 'sold' | 'held' | 'unknown-seat' }

export type PurchaseResult = { ok: true; ticket: Ticket } | { ok: false; reason: 'expired' | 'not-held' | 'sold' }

export interface SeatInfo {
  /** Seat exists and was not already sold before this system took over. */
  exists: boolean
  preSold: boolean
}

export interface TicketDetails extends Omit<Ticket, 'id' | 'code' | 'issuedAt' | 'holderName' | 'holderEmail'> {}

const STATE = 'sv:booking:v1'
const TICKETS = 'sv:tickets:v1'
export const HOLD_MS = 10 * 60 * 1000

export class BookingBackend {
  private kv: KV
  private lock: LockFn
  private now: () => number
  private seatInfo: (seatId: string) => SeatInfo
  readonly holdMs: number
  readonly authority: TicketAuthority
  /** Storage key for this event's holds and sales. */
  private stateKey: string

  constructor(opts: {
    kv: KV
    lock: LockFn
    seatInfo: (seatId: string) => SeatInfo
    now?: () => number
    holdMs?: number
    /** Separate holds / sales per event. */
    scope?: string
  }) {
    this.stateKey = opts.scope ? `${STATE}:${opts.scope}` : STATE
    this.kv = opts.kv
    this.lock = opts.lock
    this.now = opts.now ?? Date.now
    this.seatInfo = opts.seatInfo
    this.holdMs = opts.holdMs ?? HOLD_MS
    this.authority = new TicketAuthority({ kv: opts.kv, lock: opts.lock, now: this.now })
  }

  /** Current state with expired holds removed. */
  snapshot(): BookingState {
    const s = readJSON<BookingState>(this.kv, this.stateKey, { holds: {}, sold: {} })
    const t = this.now()
    for (const [id, h] of Object.entries(s.holds)) if (h.expiresAt <= t) delete s.holds[id]
    return s
  }

  private write(s: BookingState) {
    this.kv.set(this.stateKey, JSON.stringify(s))
  }

  /**
   * Hold one seat for `holder`. A customer holds one seat at a time, so any
   * previous hold of theirs is released. All-or-nothing and atomic.
   */
  hold(seatId: string, holder: string): Promise<HoldResult> {
    return this.lock(`sv-seats:${this.stateKey}`, async () => {
      const info = this.seatInfo(seatId)
      if (!info.exists) return { ok: false, reason: 'unknown-seat' } as const
      const s = this.snapshot()
      if (info.preSold || s.sold[seatId]) return { ok: false, reason: 'sold' } as const
      const existing = s.holds[seatId]
      if (existing && existing.holder !== holder) return { ok: false, reason: 'held' } as const
      for (const [id, h] of Object.entries(s.holds)) if (h.holder === holder) delete s.holds[id]
      const expiresAt = this.now() + this.holdMs
      s.holds[seatId] = { holder, expiresAt }
      this.write(s)
      return { ok: true, seatId, expiresAt } as const
    })
  }

  release(holder: string): Promise<void> {
    return this.lock(`sv-seats:${this.stateKey}`, async () => {
      const s = this.snapshot()
      let changed = false
      for (const [id, h] of Object.entries(s.holds))
        if (h.holder === holder) {
          delete s.holds[id]
          changed = true
        }
      if (changed) this.write(s)
    })
  }

  /** Turn a live hold into a sold seat and issue a signed ticket. */
  purchase(
    seatId: string,
    holder: string,
    buyer: { name: string; email: string },
    details: TicketDetails,
  ): Promise<PurchaseResult> {
    return this.lock(`sv-seats:${this.stateKey}`, async () => {
      const s = this.snapshot()
      if (s.sold[seatId]) return { ok: false, reason: 'sold' } as const
      const h = s.holds[seatId]
      if (!h) return { ok: false, reason: 'expired' } as const
      if (h.holder !== holder) return { ok: false, reason: 'not-held' } as const

      const issuedAt = this.now()
      const id = `T-${issuedAt.toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const code = await this.authority.sign({ v: 1, t: id, e: details.eventId, s: seatId, n: buyer.name, i: issuedAt })
      const ticket: Ticket = {
        ...details,
        id,
        code,
        issuedAt,
        holderName: buyer.name,
        holderEmail: buyer.email,
      }
      delete s.holds[seatId]
      s.sold[seatId] = id
      this.write(s)
      const all = readJSON<Ticket[]>(this.kv, TICKETS, [])
      all.unshift(ticket)
      this.kv.set(TICKETS, JSON.stringify(all))
      return { ok: true, ticket } as const
    })
  }

  tickets(): Ticket[] {
    return readJSON<Ticket[]>(this.kv, TICKETS, [])
  }
}
