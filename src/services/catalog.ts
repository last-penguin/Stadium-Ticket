// Venues and events managed from the admin dashboard. Stored as plain JSON
// (localStorage today; a database table later) and shared live between tabs.

import { SKYLINER_CONFIG } from '../venue/aircraft'
import { GALAXY_CONFIG } from '../venue/cinema'
import { buildVenue, type VenueLayout, type VenueModel } from '../venue/models'
import { AURORA_CONFIG } from '../venue/stadium'
import { browserKV, readJSON, type KV } from './infra'

export type VenueRecord = VenueLayout & { id: string; updatedAt: number }

export type EventCategory = 'Football' | 'Cricket' | 'Movie' | 'Concert' | 'Theatre' | 'Flight'

export interface EventRecord {
  id: string
  venueId: string
  title: string
  subtitle: string
  category: EventCategory
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  /** Price per tier id (overrides the venue's base prices). */
  prices: Record<string, number>
  status: 'on-sale' | 'draft'
}

interface CatalogData {
  venues: VenueRecord[]
  events: EventRecord[]
}

const KEY = 'sv:catalog:v1'

export function seedCatalog(): CatalogData {
  const t = 1
  return {
    venues: [
      { id: AURORA_CONFIG.id, kind: 'stadium', layout: structuredClone(AURORA_CONFIG), updatedAt: t },
      { id: GALAXY_CONFIG.id, kind: 'cinema', layout: structuredClone(GALAXY_CONFIG), updatedAt: t },
      { id: SKYLINER_CONFIG.id, kind: 'aircraft', layout: structuredClone(SKYLINER_CONFIG), updatedAt: t },
    ],
    events: [
      {
        id: 'evt-aurora-1',
        venueId: 'aurora',
        title: 'Lahore Lions vs Karachi Tides',
        subtitle: 'Super League · Matchday 14',
        category: 'Football',
        date: '2026-12-12',
        time: '20:00',
        prices: { premium: 12000, gold: 7500, standard: 4500, value: 2500 },
        status: 'on-sale',
      },
      {
        id: 'evt-galaxy-starfall',
        venueId: 'galaxy-1',
        title: 'Starfall',
        subtitle: 'Sci-fi · 2h 18m · English',
        category: 'Movie',
        date: '2026-12-18',
        time: '21:30',
        prices: { recliner: 2800, premium: 1800, classic: 1100 },
        status: 'on-sale',
      },
      {
        id: 'evt-flight-sv785',
        venueId: 'skyliner-1',
        title: 'Lahore → London',
        subtitle: 'Flight SV 785 · Wide-body · 8h 40m',
        category: 'Flight',
        date: '2026-12-20',
        time: '02:45',
        prices: { first: 520000, extra: 182000, economy: 148000 },
        status: 'on-sale',
      },
      {
        id: 'evt-aurora-2',
        venueId: 'aurora',
        title: 'Islamabad Falcons vs Lahore Lions',
        subtitle: 'Super League · Matchday 15',
        category: 'Football',
        date: '2026-12-26',
        time: '19:30',
        prices: { premium: 10000, gold: 6500, standard: 4000, value: 2000 },
        status: 'on-sale',
      },
    ],
  }
}

type Listener = () => void

export class Catalog {
  private kv: KV
  private listeners = new Set<Listener>()
  private channel: BroadcastChannel | null

  constructor(kv: KV = browserKV) {
    this.kv = kv
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('seatview-catalog') : null
    this.channel?.addEventListener('message', () => this.emit())
    if (typeof window !== 'undefined')
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) this.emit()
      })
  }

  private data(): CatalogData {
    const d = readJSON<CatalogData | null>(this.kv, KEY, null)
    if (!d || !Array.isArray(d.venues) || !Array.isArray(d.events)) return seedCatalog()
    // add demo venues/events introduced after this catalog was saved
    const seed = seedCatalog()
    const seen = readJSON<string[]>(this.kv, `${KEY}:seeded`, [])
    for (const v of seed.venues)
      if (!d.venues.some((x) => x.id === v.id) && !seen.includes(v.id)) d.venues.push(v)
    for (const e of seed.events)
      if (!d.events.some((x) => x.id === e.id) && !seen.includes(e.id)) d.events.push(e)
    return d
  }

  private write(d: CatalogData) {
    this.kv.set(KEY, JSON.stringify(d))
    this.channel?.postMessage('changed')
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }

  venues() {
    return this.data().venues
  }
  events() {
    return [...this.data().events].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  }
  venue(id: string) {
    return this.data().venues.find((v) => v.id === id) ?? null
  }
  event(id: string) {
    return this.data().events.find((e) => e.id === id) ?? null
  }

  saveVenue(v: VenueRecord) {
    const d = this.data()
    const next = { ...v, updatedAt: Date.now() }
    const i = d.venues.findIndex((x) => x.id === v.id)
    if (i >= 0) d.venues[i] = next
    else d.venues.push(next)
    this.write(d)
    return next
  }

  saveEvent(e: EventRecord) {
    const d = this.data()
    const i = d.events.findIndex((x) => x.id === e.id)
    if (i >= 0) d.events[i] = e
    else d.events.push(e)
    this.write(d)
  }

  deleteEvent(id: string) {
    // remember deleted demo events so they are not re-added
    const seen = readJSON<string[]>(this.kv, `${KEY}:seeded`, [])
    this.kv.set(`${KEY}:seeded`, JSON.stringify([...seen, id]))
    const d = this.data()
    d.events = d.events.filter((e) => e.id !== id)
    this.write(d)
  }

  reset() {
    this.write(seedCatalog())
  }

  /** A freshly built venue model for an event, with the event's prices. */
  modelFor(event: EventRecord): VenueModel | null {
    const v = this.venue(event.venueId)
    return v ? buildVenue(v, event.prices) : null
  }

  /** Cache key that changes whenever the venue layout or the event prices change. */
  versionOf(event: EventRecord) {
    const v = this.venue(event.venueId)
    return `${event.id}:${v?.updatedAt}:${JSON.stringify(event.prices)}`
  }
}

export const catalog = new Catalog()

export function formatEventDate(e: Pick<EventRecord, 'date' | 'time'>) {
  const d = new Date(`${e.date}T${e.time}:00`)
  if (Number.isNaN(d.getTime())) return `${e.date} · ${e.time}`
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${e.time}`
}
