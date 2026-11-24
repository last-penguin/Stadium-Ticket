import { create } from 'zustand'
import { catalog, type EventRecord } from '../services/catalog'
import type { VenueModel } from '../venue/models'
import type { Seat, Sector } from '../venue/types'

export type Mode = 'overview' | 'sector' | 'seat'

// The venue currently open in the explorer. `venueModel` and `currentEvent`
// are live bindings: importers always see the latest value.
const firstEvent = catalog.events()[0]
export let currentEvent: EventRecord = firstEvent
export let venueModel: VenueModel = catalog.modelFor(firstEvent)!
let sectorById = new Map<string, Sector>()
let seatById = new Map<string, Seat>()

function index(model: VenueModel) {
  sectorById = new Map(model.venue.sectors.map((s) => [s.id, s]))
  seatById = new Map()
  model.venue.sectors.forEach((s) => s.seats.forEach((seat) => seatById.set(seat.id, seat)))
}
index(venueModel)

/** Switch the explorer to another event / venue and reset the booking UI. */
export function openEvent(event: EventRecord, model: VenueModel) {
  currentEvent = event
  venueModel = model
  index(model)
  useStore.setState({
    mode: 'overview',
    ringFilter: null,
    hoveredSectorId: null,
    selectedSectorId: null,
    hoveredSeatId: null,
    selectedSeatId: null,
    compare: [],
    snapshots: {},
    compareOpen: false,
    checkoutOpen: false,
    myHold: null,
    ready: false,
    eventId: event.id,
  })
}

export const getSector = (id: string | null) => (id ? sectorById.get(id) ?? null : null)
export const getSeat = (id: string | null) => (id ? seatById.get(id) ?? null : null)
export const tierOf = (sector: Sector) => venueModel.venue.tiers.find((t) => t.id === sector.tierId)!

export interface Pointer {
  x: number
  y: number
}

interface State {
  mode: Mode
  /** null = all rings visible */
  ringFilter: number | null
  hoveredSectorId: string | null
  selectedSectorId: string | null
  hoveredSeatId: string | null
  selectedSeatId: string | null
  pointer: Pointer
  /** Bumped whenever seat statuses change so meshes recolour. */
  statusVersion: number
  ready: boolean
  eventId: string
  /** The seat this customer is currently holding (checkout timer). */
  myHold: { seatId: string; expiresAt: number } | null
  liveViewers: number
  /** True once the camera has finished flying to the current view. */
  cameraSettled: boolean
  /** Seats added to the comparison (max 3) and their captured views. */
  compare: string[]
  snapshots: Record<string, string>
  compareOpen: boolean
  checkoutOpen: boolean
  toast: { id: number; text: string; tone: 'info' | 'error' | 'success' } | null

  setReady: () => void
  addToCompare: (seatId: string, snapshot?: string) => void
  removeFromCompare: (seatId: string) => void
  setCompareOpen: (open: boolean) => void
  setSnapshot: (seatId: string, url: string) => void
  setCheckoutOpen: (open: boolean) => void
  showToast: (text: string, tone?: 'info' | 'error' | 'success') => void
  setRingFilter: (ring: number | null) => void
  hoverSector: (id: string | null) => void
  openSector: (id: string) => void
  hoverSeat: (id: string | null) => void
  openSeat: (id: string) => void
  back: () => void
  goOverview: () => void
  setPointer: (p: Pointer) => void
}

export const useStore = create<State>((set, get) => ({
  mode: 'overview',
  ringFilter: null,
  hoveredSectorId: null,
  selectedSectorId: null,
  hoveredSeatId: null,
  selectedSeatId: null,
  pointer: { x: 0, y: 0 },
  statusVersion: 0,
  ready: false,
  eventId: firstEvent.id,
  myHold: null,
  liveViewers: 1,
  cameraSettled: false,
  compare: [],
  snapshots: {},
  compareOpen: false,
  checkoutOpen: false,
  toast: null,

  setReady: () => set({ ready: true }),
  addToCompare: (seatId, snapshot) =>
    set((s) => {
      const compare = s.compare.includes(seatId) ? s.compare : [...s.compare, seatId].slice(-3)
      const snapshots = snapshot ? { ...s.snapshots, [seatId]: snapshot } : s.snapshots
      return { compare, snapshots }
    }),
  removeFromCompare: (seatId) => set((s) => ({ compare: s.compare.filter((id) => id !== seatId) })),
  setCompareOpen: (open) => set({ compareOpen: open }),
  setSnapshot: (seatId, url) => set((s) => ({ snapshots: { ...s.snapshots, [seatId]: url } })),
  setCheckoutOpen: (open) => set({ checkoutOpen: open }),
  showToast: (text, tone = 'info') => set({ toast: { id: Date.now(), text, tone } }),
  setRingFilter: (ring) => set({ ringFilter: ring, hoveredSectorId: null }),
  hoverSector: (id) => {
    if (get().hoveredSectorId !== id) set({ hoveredSectorId: id })
  },
  openSector: (id) =>
    set({
      mode: 'sector',
      selectedSectorId: id,
      hoveredSectorId: null,
      selectedSeatId: null,
      hoveredSeatId: null,
    }),
  hoverSeat: (id) => {
    if (get().hoveredSeatId !== id) set({ hoveredSeatId: id })
  },
  openSeat: (id) => {
    const seat = getSeat(id)
    if (!seat || (seat.status !== 'available' && get().myHold?.seatId !== id)) return
    set({ mode: 'seat', selectedSeatId: id, selectedSectorId: seat.sectorId, hoveredSeatId: null, compareOpen: false })
  },
  back: () => {
    const { mode } = get()
    if (mode === 'seat') set({ mode: 'sector', hoveredSeatId: null })
    else if (mode === 'sector') get().goOverview()
  },
  goOverview: () =>
    set({ mode: 'overview', selectedSectorId: null, selectedSeatId: null, hoveredSeatId: null, hoveredSectorId: null }),
  setPointer: (p) => set({ pointer: p }),
}))

if (import.meta.env.DEV) {
  Object.assign(window, { __seatview: useStore })
  Object.defineProperty(window, '__venue', { get: () => venueModel, configurable: true })
}
