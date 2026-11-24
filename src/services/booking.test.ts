import { describe, expect, it } from 'vitest'
import { BookingBackend, type TicketDetails } from './booking'
import { memoryKV, memoryLock } from './infra'
import { forge } from './tickets'

const SEATS = new Set(['101-1-1', '101-1-2', '101-1-3', '101-1-4'])
const PRESOLD = new Set(['101-1-4'])

function setup() {
  let clock = 1_000_000
  const backend = new BookingBackend({
    kv: memoryKV(),
    lock: memoryLock(),
    now: () => clock,
    holdMs: 10 * 60 * 1000,
    seatInfo: (id) => ({ exists: SEATS.has(id), preSold: PRESOLD.has(id) }),
  })
  return { backend, advance: (ms: number) => (clock += ms) }
}

const details = (seatId: string): TicketDetails => ({
  eventId: 'evt-1',
  eventTitle: 'Test Match',
  eventDate: 'Sat',
  venueName: 'Test Stadium',
  seatId,
  sectorLabel: 'Sector 101',
  standName: 'North End',
  ringName: 'Lower Tier',
  row: '1',
  seat: Number(seatId.split('-')[2]),
  price: 1000,
})
const buyer = { name: 'Ali', email: 'ali@example.com' }

describe('seat holds', () => {
  it('locks a seat for one customer and refuses another', async () => {
    const { backend } = setup()
    expect((await backend.hold('101-1-1', 'alice')).ok).toBe(true)
    const second = await backend.hold('101-1-1', 'bob')
    expect(second).toEqual({ ok: false, reason: 'held' })
  })

  it('never double-books when many customers click the same seat at the same moment', async () => {
    const { backend } = setup()
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => backend.hold('101-1-2', `fan-${i}`)),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.reason === 'held')).toHaveLength(99)
  })

  it('refuses seats that are already sold or do not exist', async () => {
    const { backend } = setup()
    expect(await backend.hold('101-1-4', 'alice')).toEqual({ ok: false, reason: 'sold' })
    expect(await backend.hold('999-9-9', 'alice')).toEqual({ ok: false, reason: 'unknown-seat' })
  })

  it('releases a hold automatically after 10 minutes', async () => {
    const { backend, advance } = setup()
    await backend.hold('101-1-1', 'alice')
    advance(10 * 60 * 1000 + 1)
    expect(backend.snapshot().holds['101-1-1']).toBeUndefined()
    expect((await backend.hold('101-1-1', 'bob')).ok).toBe(true)
  })

  it('lets a customer hold only one seat at a time', async () => {
    const { backend } = setup()
    await backend.hold('101-1-1', 'alice')
    await backend.hold('101-1-2', 'alice')
    const holds = backend.snapshot().holds
    expect(holds['101-1-1']).toBeUndefined()
    expect(holds['101-1-2']?.holder).toBe('alice')
  })
})

describe('purchase', () => {
  it('turns a hold into a sold seat with a ticket', async () => {
    const { backend } = setup()
    await backend.hold('101-1-1', 'alice')
    const res = await backend.purchase('101-1-1', 'alice', buyer, details('101-1-1'))
    expect(res.ok).toBe(true)
    expect(backend.snapshot().sold['101-1-1']).toBeDefined()
    expect(await backend.hold('101-1-1', 'bob')).toEqual({ ok: false, reason: 'sold' })
  })

  it('refuses to sell after the hold has expired', async () => {
    const { backend, advance } = setup()
    await backend.hold('101-1-1', 'alice')
    advance(11 * 60 * 1000)
    const res = await backend.purchase('101-1-1', 'alice', buyer, details('101-1-1'))
    expect(res).toEqual({ ok: false, reason: 'expired' })
  })

  it("refuses to sell a seat held by someone else", async () => {
    const { backend } = setup()
    await backend.hold('101-1-1', 'alice')
    const res = await backend.purchase('101-1-1', 'mallory', buyer, details('101-1-1'))
    expect(res).toEqual({ ok: false, reason: 'not-held' })
  })
})

describe('QR tickets', () => {
  async function bought() {
    const s = setup()
    await s.backend.hold('101-1-1', 'alice')
    const res = await s.backend.purchase('101-1-1', 'alice', buyer, details('101-1-1'))
    if (!res.ok) throw new Error('purchase failed')
    return { ...s, ticket: res.ticket }
  }

  it('issues a signed code that verifies', async () => {
    const { backend, ticket } = await bought()
    expect(ticket.code.startsWith('SV1.')).toBe(true)
    const v = await backend.authority.verify(ticket.code)
    expect(v.ok && v.payload.s).toBe('101-1-1')
  })

  it('admits a ticket only once', async () => {
    const { backend, ticket } = await bought()
    expect((await backend.authority.redeem(ticket.code, 'Gate A', 'evt-1')).status).toBe('valid')
    const again = await backend.authority.redeem(ticket.code, 'Gate B', 'evt-1')
    expect(again.status).toBe('used')
    if (again.status === 'used') expect(again.gate).toBe('Gate A')
  })

  it('admits only one of two simultaneous scans of the same screenshot', async () => {
    const { backend, ticket } = await bought()
    const [a, b] = await Promise.all([
      backend.authority.redeem(ticket.code, 'Gate A', 'evt-1'),
      backend.authority.redeem(ticket.code, 'Gate C', 'evt-1'),
    ])
    expect([a.status, b.status].sort()).toEqual(['used', 'valid'])
  })

  it('rejects a ticket whose details were edited', async () => {
    const { backend, ticket } = await bought()
    const fake = forge(ticket.code)
    expect(fake).not.toBe(ticket.code)
    expect(await backend.authority.redeem(fake, 'Gate A', 'evt-1')).toEqual({ status: 'invalid', reason: 'bad-signature' })
  })

  it('rejects garbage and tickets for another event', async () => {
    const { backend, ticket } = await bought()
    expect((await backend.authority.redeem('hello world', 'Gate A')).status).toBe('invalid')
    expect((await backend.authority.redeem(ticket.code, 'Gate A', 'other-event')).status).toBe('wrong-event')
  })
})
