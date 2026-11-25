// Signed digital tickets.
//
// A ticket's QR code is "SV1.<payload>.<signature>". The payload is the
// ticket id, event and seat; the signature is ECDSA P-256 over the payload.
// Anyone can *read* a ticket, but changing a single character breaks the
// signature, and the gate's redemption ledger lets each ticket in only once,
// so screenshots and copies are useless after the first scan.
//
// In production the private key lives only on the server; for this demo the
// issuer key is generated once and kept in local storage.

import { readJSON, type KV, type LockFn } from './infra'

export interface TicketPayload {
  v: 1
  /** ticket id */
  t: string
  /** event id */
  e: string
  /** seat id */
  s: string
  /** holder name */
  n: string
  /** issued at (ms) */
  i: number
}

export interface Ticket {
  id: string
  code: string
  eventId: string
  eventTitle: string
  eventDate: string
  venueName: string
  seatId: string
  sectorLabel: string
  standName: string
  ringName: string
  row: string
  seat: number
  /** Short seat name, e.g. "23A" on a plane. */
  seatLabel?: string
  price: number
  holderName: string
  holderEmail: string
  issuedAt: number
}

export type VerifyResult =
  | { ok: true; payload: TicketPayload }
  | { ok: false; reason: 'malformed' | 'bad-signature' }

export type RedeemResult =
  | { status: 'valid'; payload: TicketPayload; at: number; gate: string }
  | { status: 'used'; payload: TicketPayload; at: number; gate: string }
  | { status: 'wrong-event'; payload: TicketPayload }
  | { status: 'invalid'; reason: 'malformed' | 'bad-signature' }

const enc = new TextEncoder()
const dec = new TextDecoder()

export const b64url = (bytes: Uint8Array) => {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const fromB64url = (str: string) => {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const
const KEY_STORE = 'sv:issuer-key:v1'
const LEDGER = 'sv:redeemed:v1'

export class TicketAuthority {
  private kv: KV
  private lock: LockFn
  private now: () => number
  private keys: Promise<CryptoKeyPair> | null = null

  constructor(opts: { kv: KV; lock: LockFn; now?: () => number }) {
    this.kv = opts.kv
    this.lock = opts.lock
    this.now = opts.now ?? Date.now
  }

  private loadKeys(): Promise<CryptoKeyPair> {
    if (!this.keys) {
      this.keys = (async () => {
        const stored = readJSON<{ priv: JsonWebKey; pub: JsonWebKey } | null>(this.kv, KEY_STORE, null)
        if (stored) {
          const privateKey = await crypto.subtle.importKey('jwk', stored.priv, ALG, true, ['sign'])
          const publicKey = await crypto.subtle.importKey('jwk', stored.pub, ALG, true, ['verify'])
          return { privateKey, publicKey }
        }
        const pair = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])
        const priv = await crypto.subtle.exportKey('jwk', pair.privateKey)
        const pub = await crypto.subtle.exportKey('jwk', pair.publicKey)
        this.kv.set(KEY_STORE, JSON.stringify({ priv, pub }))
        return pair
      })()
    }
    return this.keys
  }

  async sign(payload: TicketPayload): Promise<string> {
    const { privateKey } = await this.loadKeys()
    const body = b64url(enc.encode(JSON.stringify(payload)))
    const sig = new Uint8Array(await crypto.subtle.sign(SIGN, privateKey, enc.encode(body)))
    return `SV1.${body}.${b64url(sig)}`
  }

  async verify(code: string): Promise<VerifyResult> {
    const parts = code.trim().split('.')
    if (parts.length !== 3 || parts[0] !== 'SV1') return { ok: false, reason: 'malformed' }
    const [, body, sig] = parts
    let payload: TicketPayload
    let sigBytes: Uint8Array
    try {
      payload = JSON.parse(dec.decode(fromB64url(body)))
      sigBytes = fromB64url(sig)
    } catch {
      return { ok: false, reason: 'malformed' }
    }
    if (payload?.v !== 1 || typeof payload.t !== 'string') return { ok: false, reason: 'malformed' }
    const { publicKey } = await this.loadKeys()
    const ok = await crypto.subtle.verify(SIGN, publicKey, sigBytes as BufferSource, enc.encode(body))
    return ok ? { ok: true, payload } : { ok: false, reason: 'bad-signature' }
  }

  /** Verify a scanned code and let it in at most once. */
  async redeem(code: string, gate: string, expectedEventId?: string): Promise<RedeemResult> {
    const v = await this.verify(code)
    if (!v.ok) return { status: 'invalid', reason: v.reason }
    const payload = v.payload
    if (expectedEventId && payload.e !== expectedEventId) return { status: 'wrong-event', payload }
    // The check-and-mark happens inside a lock, so two gates scanning the
    // same screenshot at the same moment cannot both say "valid".
    return this.lock('sv-gate', async () => {
      const ledger = readJSON<Record<string, { at: number; gate: string }>>(this.kv, LEDGER, {})
      const prior = ledger[payload.t]
      if (prior) return { status: 'used' as const, payload, at: prior.at, gate: prior.gate }
      const at = this.now()
      ledger[payload.t] = { at, gate }
      this.kv.set(LEDGER, JSON.stringify(ledger))
      return { status: 'valid' as const, payload, at, gate }
    })
  }

  redemption(ticketId: string): { at: number; gate: string } | null {
    return readJSON<Record<string, { at: number; gate: string }>>(this.kv, LEDGER, {})[ticketId] ?? null
  }
}

/** Flip one character in the payload: what a forger editing a ticket would do. */
export function forge(code: string): string {
  const [v, body, sig] = code.split('.')
  try {
    const p = JSON.parse(dec.decode(fromB64url(body))) as TicketPayload
    p.s = p.s.replace(/-(\d+)$/, (_, n) => `-${Number(n) + 1}`)
    return `${v}.${b64url(enc.encode(JSON.stringify(p)))}.${sig}`
  } catch {
    return `${v}.${body}x.${sig}`
  }
}
