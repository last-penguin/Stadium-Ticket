// Core data model for a venue. Everything the 3D scene and the booking UI
// need is derived from these plain objects, so a venue can be described as
// data (layout config) instead of hand-written code.

export type Vec3 = [number, number, number]

export type SeatStatus = 'available' | 'sold' | 'held'

export interface PriceTier {
  id: string
  name: string
  price: number
  color: string
}

export interface Seat {
  /** Globally unique id, e.g. "214-8-9" (sector-row-seat). */
  id: string
  sectorId: string
  row: number
  /** Display label for the row ("7", or "F" in a cinema). */
  rowLabel: string
  number: number
  position: Vec3
  /** Rotation around Y so the seat faces the pitch. */
  rotationY: number
  /** Where a seated spectator's eyes are. Used for the seat view. */
  eye: Vec3
  accessible: boolean
  status: SeatStatus
}

export interface Sector {
  id: string
  /** Display label, e.g. "Sector 214". */
  label: string
  standName: string
  ringIndex: number
  tierId: string
  /** Parameter range along the bowl perimeter (0..1). */
  u0: number
  u1: number
  /** Centre of the seating block (for camera framing). */
  center: Vec3
  /** Unit vector pointing from the bowl outwards (away from the pitch). */
  outward: Vec3
  seats: Seat[]
}

export interface Ring {
  index: number
  name: string
  shortName: string
  /** Distance from the inner bowl edge where the first row starts. */
  dStart: number
  rows: number
  rowDepth: number
  rowRise: number
  /** Height of the first row's tread above the pitch. */
  y0: number
}

export interface VenueEvent {
  id: string
  title: string
  home: string
  away: string
  date: string
  time: string
  competition: string
}

export type VenueKind = 'stadium' | 'cinema'

export interface VenueView {
  /** Camera for the establishing shot. */
  overview: { position: Vec3; target: Vec3; minDistance: number; maxDistance: number; maxPolar: number }
  /** Default near/far framing distance for a sector close-up. */
  sectorDistance: number
}

export interface VenueTerms {
  /** Names of the 4 booking steps. */
  steps: [string, string, string, string]
  /** "stand" / "section" - used in sentences. */
  area: string
  /** Title of the first step, e.g. "Pick a stand". */
  pickArea: string
}

export interface Venue {
  id: string
  name: string
  city: string
  kind: VenueKind
  rings: Ring[]
  sectors: Sector[]
  tiers: PriceTier[]
  /** Points of interest for distance read-outs. */
  focus: { centre: Vec3; goals: Vec3[]; screen?: { center: Vec3; width: number; height: number } }
  view: VenueView
  terms: VenueTerms
  seatCount: number
}
