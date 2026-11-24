// Browser wiring for the booking backend: one backend per event, live updates
// between tabs (each tab is a separate customer), and painting the latest
// holds / sales onto the 3D venue's seats.

import { currentEvent, getSeat, useStore, venueModel } from '../state/store'
import type { VenueModel } from '../venue/models'
import { BookingBackend } from './booking'
import { browserKV, browserLock } from './infra'

const lock = browserLock()

/** Seats that were already sold in the demo data, per venue model. */
const baselines = new WeakMap<VenueModel, Map<string, boolean>>()
export function baselineOf(model: VenueModel) {
  let b = baselines.get(model)
  if (!b) {
    b = new Map()
    for (const s of model.venue.sectors) for (const seat of s.seats) b.set(seat.id, seat.status === 'sold')
    baselines.set(model, b)
  }
  return b
}

/** A booking backend for one event of one venue model. */
export function backendFor(eventId: string, model: VenueModel) {
  const base = baselineOf(model)
  return new BookingBackend({
    kv: browserKV,
    lock,
    scope: eventId,
    seatInfo: (id) => ({ exists: base.has(id), preSold: base.get(id) === true }),
  })
}

// Live binding: always the backend of the event open in the explorer.
export let backend = backendFor(currentEvent.id, venueModel)

/** This tab's customer id (a new customer per tab, so two tabs = two people). */
export const holderId = (() => {
  const make = () => `C-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  try {
    const existing = sessionStorage.getItem('sv:holder')
    if (existing) return existing
    const id = make()
    sessionStorage.setItem('sv:holder', id)
    return id
  } catch {
    return make()
  }
})()

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('seatview') : null
let changed = new Set<string>()
let activeModel: VenueModel = venueModel

/** Re-read booking state and paint it onto the venue. */
export function syncSeats() {
  const base = baselineOf(activeModel)
  const snap = backend.snapshot()
  const next = new Set<string>()
  changed.forEach((id) => {
    const seat = getSeat(id)
    if (seat) seat.status = base.get(id) ? 'sold' : 'available'
  })
  let myHold: { seatId: string; expiresAt: number } | null = null
  for (const [id, h] of Object.entries(snap.holds)) {
    const seat = getSeat(id)
    if (!seat) continue
    seat.status = 'held'
    next.add(id)
    if (h.holder === holderId) myHold = { seatId: id, expiresAt: h.expiresAt }
  }
  for (const id of Object.keys(snap.sold)) {
    const seat = getSeat(id)
    if (!seat) continue
    seat.status = 'sold'
    next.add(id)
  }
  changed = next
  useStore.setState((s) => ({ statusVersion: s.statusVersion + 1, myHold }))
}

/** Tell other tabs (and the admin dashboard) that seats changed. */
export function announce() {
  channel?.postMessage({ type: 'seats', eventId: currentEvent.id })
  syncSeats()
}

/** Point the live layer at the event that was just opened. */
export function switchLiveEvent(eventId: string, model: VenueModel) {
  if (activeModel === model && backend && currentEvent.id === eventId) return
  activeModel = model
  changed = new Set()
  backend = backendFor(eventId, model)
  syncSeats()
}

// --- presence: how many people are browsing right now ----------------------
const seen = new Map<string, number>()
function heartbeat() {
  channel?.postMessage({ type: 'hello', id: holderId })
  const now = Date.now()
  seen.set(holderId, now)
  for (const [id, t] of seen) if (now - t > 7000) seen.delete(id)
  useStore.setState({ liveViewers: seen.size })
}

/** Subscribe to seat changes from other tabs (also used by the admin page). */
export function onSeatsChanged(cb: (eventId: string) => void) {
  const handler = (e: MessageEvent) => e.data?.type === 'seats' && cb(e.data.eventId)
  const storage = (e: StorageEvent) => {
    if (e.key?.startsWith('sv:booking')) cb(e.key.split(':').slice(3).join(':'))
  }
  channel?.addEventListener('message', handler)
  window.addEventListener('storage', storage)
  return () => {
    channel?.removeEventListener('message', handler)
    window.removeEventListener('storage', storage)
  }
}

let started = false
export function startLive() {
  if (started) return
  started = true
  syncSeats()
  onSeatsChanged((eventId) => {
    if (!eventId || eventId === currentEvent.id) syncSeats()
  })
  channel?.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'hello') {
      seen.set(e.data.id, Date.now())
      useStore.setState({ liveViewers: seen.size })
    }
  })
  heartbeat()
  setInterval(heartbeat, 3000)
  // expire holds that time out while nobody is clicking
  setInterval(() => {
    const before = useStore.getState().myHold
    const snap = backend.snapshot()
    const anyExpired = [...changed].some((id) => getSeat(id)?.status === 'held' && !snap.holds[id])
    if (anyExpired || (before && !snap.holds[before.seatId])) syncSeats()
  }, 1000)
}

if (import.meta.env.DEV)
  Object.defineProperty(window, '__booking', {
    get: () => ({ backend, holderId, announce }),
    configurable: true,
  })
