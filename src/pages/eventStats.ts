import { catalog, type EventRecord } from '../services/catalog'
import { baselineOf, backendFor } from '../services/live'
import type { VenueModel } from '../venue/models'

// Per-event numbers used by the home page and the admin dashboard. The venue
// model is built once per layout/price version and reused.

const models = new Map<string, VenueModel>()

export function modelFor(event: EventRecord) {
  const key = catalog.versionOf(event)
  let m = models.get(key)
  if (!m) {
    const built = catalog.modelFor(event)
    if (!built) return null
    m = built
    models.set(key, m)
  }
  return m
}

export interface SectorStat {
  id: string
  label: string
  ringIndex: number
  tierId: string
  total: number
  sold: number
  held: number
}

export interface EventStats {
  event: EventRecord
  model: VenueModel
  capacity: number
  sold: number
  held: number
  /** Tickets sold through SeatView (the rest are demo pre-sales). */
  online: number
  revenue: number
  onlineRevenue: number
  minPrice: number
  sectors: SectorStat[]
  byTier: { id: string; name: string; color: string; price: number; sold: number; capacity: number; revenue: number }[]
}

export function statsFor(event: EventRecord): EventStats | null {
  const model = modelFor(event)
  if (!model) return null
  const base = baselineOf(model)
  const snap = backendFor(event.id, model).snapshot()
  const tickets = backendFor(event.id, model).tickets().filter((t) => t.eventId === event.id)
  const priceOf = new Map(model.venue.tiers.map((t) => [t.id, t.price]))
  const byTier = new Map(
    model.venue.tiers.map((t) => [t.id, { id: t.id, name: t.name, color: t.color, price: t.price, sold: 0, capacity: 0, revenue: 0 }]),
  )

  let capacity = 0
  let sold = 0
  let held = 0
  let revenue = 0
  const sectors: SectorStat[] = model.venue.sectors.map((sec) => {
    let sSold = 0
    let sHeld = 0
    const price = priceOf.get(sec.tierId) ?? 0
    const tier = byTier.get(sec.tierId)!
    for (const seat of sec.seats) {
      const isSold = base.get(seat.id) || !!snap.sold[seat.id]
      if (isSold) sSold++
      else if (snap.holds[seat.id]) sHeld++
    }
    capacity += sec.seats.length
    sold += sSold
    held += sHeld
    tier.capacity += sec.seats.length
    tier.sold += sSold
    tier.revenue += sSold * price
    revenue += sSold * price
    return { id: sec.id, label: sec.label, ringIndex: sec.ringIndex, tierId: sec.tierId, total: sec.seats.length, sold: sSold, held: sHeld }
  })

  return {
    event,
    model,
    capacity,
    sold,
    held,
    online: tickets.length,
    revenue,
    onlineRevenue: tickets.reduce((n, t) => n + t.price, 0),
    minPrice: Math.min(...model.venue.tiers.map((t) => t.price)),
    sectors,
    byTier: [...byTier.values()],
  }
}
