import { Bowl, type BowlShape, type SegmentKind } from './bowl'
import type { PriceTier, Ring, Seat, Sector, Venue } from './types'

// ---------------------------------------------------------------------------
// Layout config. A venue is described entirely by this object, which is what
// the admin layout tool will eventually edit.
// ---------------------------------------------------------------------------

export interface RingConfig {
  name: string
  shortName: string
  rows: number
  rowDepth: number
  rowRise: number
  /** Horizontal gap (concourse) before this ring starts. */
  gapBefore: number
  /** Vertical lift above the previous ring's last row. */
  liftBefore: number
}

/** Which price tier each part of the bowl gets, per ring (last entry repeats). */
export interface TierMap {
  /** [middle of the side stand, edges of the side stand] */
  side: [string, string][]
  end: string[]
  corner: string[]
}

/** Serializable stadium layout - this is what the admin layout editor edits. */
export interface StadiumConfig {
  id: string
  name: string
  city: string
  shape: BowlShape
  firstRowOffset: number
  firstRowHeight: number
  rings: RingConfig[]
  sectorsPerSegment: Record<SegmentKind, number>
  seatWidth: number
  aisleWidth: number
  tiers: PriceTier[]
  tierMap: TierMap
  pitch: { length: number; width: number }
}

const pick = <T,>(arr: T[], i: number): T => arr[Math.min(i, arr.length - 1)]

/** `centrality` is 0 at the middle of a stand and 1 at its edge. */
export function tierFor(cfg: StadiumConfig, ring: number, kind: SegmentKind, centrality: number): string {
  const m = cfg.tierMap
  const id =
    kind === 'side' ? pick(m.side, ring)[centrality < 0.6 ? 0 : 1] : kind === 'end' ? pick(m.end, ring) : pick(m.corner, ring)
  return cfg.tiers.some((t) => t.id === id) ? id : cfg.tiers[cfg.tiers.length - 1].id
}

export type ProfileKind = 'floor' | 'wall' | 'tread' | 'riser' | 'concourse' | 'fascia' | 'rim' | 'outer'

export interface ProfilePoint {
  d: number
  y: number
  /** Kind of the surface between this point and the next. */
  kind: ProfileKind
}

export interface StadiumModel {
  venue: Venue
  bowl: Bowl
  config: StadiumConfig
  /** Cross-section of the whole bowl, inner edge to outer facade. */
  profile: ProfilePoint[]
  outerD: number
  rimY: number
  roof: { dFront: number; dBack: number; yFront: number; yBack: number }
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers (demo occupancy must be stable between
// reloads so screenshots and tests match).
// ---------------------------------------------------------------------------

function hash3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

// ---------------------------------------------------------------------------

export function buildStadium(cfg: StadiumConfig): StadiumModel {
  const bowl = new Bowl(cfg.shape)

  // 1. Rings: stack them outwards and upwards.
  const rings: Ring[] = []
  let dCursor = cfg.firstRowOffset
  let yCursor = cfg.firstRowHeight
  cfg.rings.forEach((rc, i) => {
    if (i > 0) {
      const prev = rings[i - 1]
      dCursor = prev.dStart + prev.rows * prev.rowDepth + rc.gapBefore
      yCursor = prev.y0 + (prev.rows - 1) * prev.rowRise + rc.liftBefore
    }
    rings.push({
      index: i,
      name: rc.name,
      shortName: rc.shortName,
      dStart: dCursor,
      rows: rc.rows,
      rowDepth: rc.rowDepth,
      rowRise: rc.rowRise,
      y0: yCursor,
    })
  })

  // 2. Sectors and seats.
  const sectors: Sector[] = []
  let seatCount = 0
  rings.forEach((ring) => {
    let sectorNo = 1
    bowl.segments.forEach((seg, segIdx) => {
      const n = cfg.sectorsPerSegment[seg.kind]
      for (let k = 0; k < n; k++) {
        const u0 = seg.u0 + ((seg.u1 - seg.u0) * k) / n
        const u1 = seg.u0 + ((seg.u1 - seg.u0) * (k + 1)) / n
        const centrality = n === 1 ? 0 : Math.abs(k - (n - 1) / 2) / ((n - 1) / 2)
        const tierId = tierFor(cfg, ring.index, seg.kind, centrality)
        const num = (ring.index + 1) * 100 + sectorNo
        const id = String(num)
        const uMid = (u0 + u1) / 2
        const dMid = ring.dStart + (ring.rows * ring.rowDepth) / 2
        const pMid = bowl.point(uMid, dMid, segIdx)
        const yMid = ring.y0 + ((ring.rows - 1) * ring.rowRise) / 2

        const demand =
          tierId === 'premium' ? 0.62 : tierId === 'gold' ? 0.5 : tierId === 'standard' ? 0.42 : 0.3
        const seats: Seat[] = []
        for (let r = 0; r < ring.rows; r++) {
          const d = ring.dStart + r * ring.rowDepth + ring.rowDepth * 0.55
          const y = ring.y0 + r * ring.rowRise
          const L = bowl.arcLength(u0, u1, d)
          const count = Math.max(0, Math.floor((L - cfg.aisleWidth) / cfg.seatWidth))
          const start = (L - count * cfg.seatWidth) / 2 + cfg.seatWidth / 2
          for (let s = 0; s < count; s++) {
            const u = u0 + ((start + s * cfg.seatWidth) / L) * (u1 - u0)
            const p = bowl.point(u, d, segIdx)
            const rowNo = r + 1
            const seatNo = s + 1
            const accessible = ring.index === 0 && r === ring.rows - 1 && (s < 2 || s >= count - 2)
            // Clustered occupancy: groups of 2-4 seats share a draw, and a
            // smooth wave makes some areas busier than others.
            const group = Math.floor(s / (2 + (hash3(num, r, 7) * 3) | 0))
            const wave = 0.5 + 0.5 * Math.sin(r * 0.45 + s * 0.09 + num * 1.3)
            const sold = !accessible && hash3(num, r, group) < demand * (0.55 + 0.9 * wave)
            seats.push({
              id: `${id}-${rowNo}-${seatNo}`,
              sectorId: id,
              row: rowNo,
              rowLabel: String(rowNo),
              number: seatNo,
              position: [p.x, y, p.z],
              rotationY: Math.atan2(-p.nx, -p.nz),
              eye: [p.x + p.nx * 0.1, y + 1.18, p.z + p.nz * 0.1],
              accessible,
              status: sold ? 'sold' : 'available',
            })
          }
        }
        seatCount += seats.length
        sectors.push({
          id,
          label: `Sector ${id}`,
          standName: seg.name,
          ringIndex: ring.index,
          tierId,
          u0,
          u1,
          center: [pMid.x, yMid, pMid.z],
          outward: [pMid.nx, 0, pMid.nz],
          seats,
        })
        sectorNo++
      }
    })
  })

  // 3. Cross-section profile of the bowl.
  const profile: ProfilePoint[] = []
  const push = (d: number, y: number, kind: ProfileKind) => profile.push({ d, y, kind })
  push(-1.5, 0.02, 'floor')
  rings.forEach((ring, i) => {
    if (i === 0) {
      push(ring.dStart - 0.2, 0.02, 'wall')
    } else {
      const prev = rings[i - 1]
      const prevTop = prev.y0 + (prev.rows - 1) * prev.rowRise
      push(prev.dStart + prev.rows * prev.rowDepth, prevTop, 'concourse')
      push(ring.dStart - 0.2, prevTop, 'fascia')
    }
    // front wall up to just above the first tread (a parapet)
    push(ring.dStart - 0.2, ring.y0 + 0.8, 'rim')
    push(ring.dStart, ring.y0 + 0.8, 'wall')
    for (let r = 0; r < ring.rows; r++) {
      const d = ring.dStart + r * ring.rowDepth
      const y = ring.y0 + r * ring.rowRise
      push(d, y, 'tread')
      if (r < ring.rows - 1) push(d + ring.rowDepth, y, 'riser')
    }
  })
  const last = rings[rings.length - 1]
  const outerD = last.dStart + last.rows * last.rowDepth
  const topY = last.y0 + (last.rows - 1) * last.rowRise
  const rimY = topY + 2.2
  push(outerD, topY, 'wall')
  push(outerD, rimY, 'rim')
  push(outerD + 0.8, rimY, 'outer')
  push(outerD + 0.8, 0, 'outer')

  const venue: Venue = {
    id: cfg.id,
    name: cfg.name,
    city: cfg.city,
    kind: 'stadium',
    rings,
    sectors,
    tiers: cfg.tiers.map((t) => ({ ...t })),
    focus: {
      centre: [0, 0, 0],
      goals: [
        [cfg.pitch.length / 2, 0, 0],
        [-cfg.pitch.length / 2, 0, 0],
      ],
    },
    view: {
      overview: {
        position: [outerD * 1.6 + 110, outerD * 1.35 + 95, outerD * 1.85 + 125],
        target: [0, 4, 0],
        minDistance: 90,
        maxDistance: 700,
        maxPolar: 1.3,
      },
      sectorDistance: 26,
    },
    terms: { steps: ['Stand', 'Block', 'Seat', 'Buy'], area: 'stand', pickArea: 'Pick a stand' },
    seatCount,
  }

  const ring2 = rings[Math.min(1, rings.length - 1)]
  return {
    venue,
    bowl,
    config: cfg,
    profile,
    outerD,
    rimY,
    roof: {
      dFront: ring2.dStart + ring2.rows * ring2.rowDepth * 0.55,
      dBack: outerD + 0.8,
      yFront: rimY + 9,
      yBack: rimY + 3.5,
    },
  }
}

// ---------------------------------------------------------------------------
// Demo venue: a fictional 3-tier football stadium.
// ---------------------------------------------------------------------------

export const AURORA_TIERS: PriceTier[] = [
  { id: 'premium', name: 'Premium', price: 12000, color: '#f04a5c' },
  { id: 'gold', name: 'Gold', price: 7500, color: '#d9932c' },
  { id: 'standard', name: 'Standard', price: 4500, color: '#4f8cff' },
  { id: 'value', name: 'Value', price: 2500, color: '#1fa877' },
]

export const AURORA_CONFIG: StadiumConfig = {
  id: 'aurora',
  name: 'Aurora Stadium',
  city: 'Lahore',
  shape: { hx: 60, hz: 41, r: 14 },
  firstRowOffset: 2.5,
  firstRowHeight: 1.3,
  rings: [
    { name: 'Lower Tier', shortName: 'Lower', rows: 18, rowDepth: 0.85, rowRise: 0.36, gapBefore: 0, liftBefore: 0 },
    { name: 'Middle Tier', shortName: 'Middle', rows: 16, rowDepth: 0.85, rowRise: 0.48, gapBefore: 2.6, liftBefore: 3.6 },
    { name: 'Upper Tier', shortName: 'Upper', rows: 15, rowDepth: 0.9, rowRise: 0.58, gapBefore: 2.6, liftBefore: 3.8 },
  ],
  sectorsPerSegment: { end: 3, side: 5, corner: 2 },
  seatWidth: 0.55,
  aisleWidth: 1.3,
  tiers: AURORA_TIERS,
  tierMap: {
    side: [
      ['premium', 'gold'],
      ['gold', 'standard'],
      ['standard', 'value'],
    ],
    end: ['standard', 'standard', 'value'],
    corner: ['standard', 'value'],
  },
  pitch: { length: 105, width: 68 },
}

