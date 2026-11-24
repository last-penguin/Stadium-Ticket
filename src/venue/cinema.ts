import type { PriceTier, Ring, Seat, Sector, Venue } from './types'

// A cinema hall described as data. Rows are slightly curved around the
// screen and raked (each row higher than the one in front). Sections run
// front-to-back (e.g. Classic / Premium / Recliner) and aisles split every
// row into blocks (left / centre / right).

export interface CinemaSection {
  name: string
  shortName: string
  rows: number
  tierId: string
  seatsPerRow: number
  /** Seat numbers after which there is an aisle, e.g. [4, 14]. */
  aislesAfter: number[]
  seatWidth: number
}

export interface CinemaConfig {
  id: string
  name: string
  city: string
  hall: { width: number; depth: number; height: number }
  screen: { width: number; height: number; bottom: number }
  /** Distance from the screen to the first row. */
  firstRowDistance: number
  firstRowHeight: number
  rowDepth: number
  rowRise: number
  aisleWidth: number
  /** Radius of row curvature in metres (0 = straight rows). */
  curveRadius: number
  sections: CinemaSection[]
  tiers: PriceTier[]
}

export interface CinemaModel {
  venue: Venue
  config: CinemaConfig
  /** z of the screen plane (screen faces +z). */
  screenZ: number
  /** z where the last row ends. */
  backZ: number
  topY: number
}

const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I / O, like real cinemas

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export function buildCinema(cfg: CinemaConfig): CinemaModel {
  const screenZ = -cfg.firstRowDistance
  const rings: Ring[] = []
  const sectors: Sector[] = []
  let rowCursor = 0
  let seatCount = 0
  const R = cfg.curveRadius

  cfg.sections.forEach((sec, si) => {
    const ring: Ring = {
      index: si,
      name: sec.name,
      shortName: sec.shortName,
      dStart: rowCursor * cfg.rowDepth,
      rows: sec.rows,
      rowDepth: cfg.rowDepth,
      rowRise: cfg.rowRise,
      y0: cfg.firstRowHeight + rowCursor * cfg.rowRise,
    }
    rings.push(ring)

    // blocks from aisles
    const cuts = [0, ...sec.aislesAfter.filter((a) => a > 0 && a < sec.seatsPerRow), sec.seatsPerRow]
    const blockNames =
      cuts.length - 1 === 3 ? ['Left', 'Centre', 'Right'] : cuts.length - 1 === 2 ? ['Left', 'Right'] : cuts.slice(1).map((_, i) => `Block ${i + 1}`)
    const blocks = cuts.slice(1).map((end, b) => ({ start: cuts[b], end, name: cuts.length === 2 ? 'Centre' : blockNames[b] }))
    const rowWidth = sec.seatsPerRow * sec.seatWidth + (blocks.length - 1) * cfg.aisleWidth

    blocks.forEach((block, bi) => {
      const id = `${sec.shortName[0].toUpperCase()}${bi + 1}`
      const seats: Seat[] = []
      let cx = 0
      let cy = 0
      let cz = 0
      for (let r = 0; r < sec.rows; r++) {
        const globalRow = rowCursor + r
        const z = globalRow * cfg.rowDepth
        const y = cfg.firstRowHeight + globalRow * cfg.rowRise
        const letter = ROW_LETTERS[globalRow % ROW_LETTERS.length]
        for (let s = block.start; s < block.end; s++) {
          const x = -rowWidth / 2 + s * sec.seatWidth + bi * cfg.aisleWidth + sec.seatWidth / 2
          let px = x
          let pz = z
          let rot = Math.PI // facing -z (the screen)
          if (R > 0) {
            const rr = R + z
            const theta = x / rr
            px = Math.sin(theta) * rr
            pz = Math.cos(theta) * rr - R
            rot = Math.atan2(-Math.sin(theta), -Math.cos(theta))
          }
          const seatNo = s + 1
          const fx = Math.sin(rot)
          const fz = Math.cos(rot)
          const accessible = globalRow === rowCursor && si === 0 && (s === block.start || s === block.end - 1) && bi !== 1
          const sold = !accessible && hash(globalRow * 97 + s, si * 13 + 5) < 0.28 + 0.3 * Math.sin(s * 0.35 + globalRow) ** 2
          seats.push({
            id: `${id}-${letter}-${seatNo}`,
            sectorId: id,
            row: globalRow + 1,
            rowLabel: letter,
            number: seatNo,
            position: [px, y, pz],
            rotationY: rot,
            eye: [px - fx * 0.12, y + 1.12, pz - fz * 0.12],
            accessible,
            status: sold ? 'sold' : 'available',
          })
          cx += px
          cy += y
          cz += pz
        }
      }
      const n = Math.max(1, seats.length)
      seatCount += seats.length
      sectors.push({
        id,
        label: `${sec.name} · ${block.name}`,
        standName: `${block.name} block`,
        ringIndex: si,
        tierId: sec.tierId,
        u0: 0,
        u1: 0,
        center: [cx / n, cy / n, cz / n],
        outward: [0, 0, 1],
        seats,
      })
    })
    rowCursor += sec.rows
  })

  const totalRows = rowCursor
  const backZ = totalRows * cfg.rowDepth
  const topY = cfg.firstRowHeight + totalRows * cfg.rowRise
  const screenCenter: [number, number, number] = [0, cfg.screen.bottom + cfg.screen.height / 2, screenZ]
  const { width: W, depth: D, height: H } = cfg.hall

  const venue: Venue = {
    id: cfg.id,
    name: cfg.name,
    city: cfg.city,
    kind: 'cinema',
    rings,
    sectors,
    tiers: cfg.tiers.map((t) => ({ ...t })),
    focus: { centre: screenCenter, goals: [], screen: { center: screenCenter, width: cfg.screen.width, height: cfg.screen.height } },
    view: {
      overview: {
        position: [W * 0.95, H * 2.4, backZ + D * 0.55],
        target: [0, 1, (screenZ + backZ) / 2],
        minDistance: 10,
        maxDistance: 70,
        maxPolar: 1.25,
      },
      sectorDistance: 7,
    },
    terms: { steps: ['Section', 'Block', 'Seat', 'Buy'], area: 'section', pickArea: 'Pick a section' },
    seatCount,
  }
  return { venue, config: cfg, screenZ, backZ, topY }
}

export const GALAXY_TIERS: PriceTier[] = [
  { id: 'recliner', name: 'Recliner', price: 2800, color: '#f04a5c' },
  { id: 'premium', name: 'Premium', price: 1800, color: '#d9932c' },
  { id: 'classic', name: 'Classic', price: 1100, color: '#4f8cff' },
]

export const GALAXY_CONFIG: CinemaConfig = {
  id: 'galaxy-1',
  name: 'Galaxy Cinemas · Screen 1',
  city: 'Lahore',
  hall: { width: 24, depth: 30, height: 11 },
  screen: { width: 17, height: 7.2, bottom: 1.8 },
  firstRowDistance: 6.5,
  firstRowHeight: 0.3,
  rowDepth: 1.05,
  rowRise: 0.42,
  aisleWidth: 1.3,
  curveRadius: 26,
  sections: [
    { name: 'Classic', shortName: 'Classic', rows: 5, tierId: 'classic', seatsPerRow: 22, aislesAfter: [5, 17], seatWidth: 0.62 },
    { name: 'Premium', shortName: 'Premium', rows: 6, tierId: 'premium', seatsPerRow: 22, aislesAfter: [5, 17], seatWidth: 0.62 },
    { name: 'Recliner', shortName: 'Recliner', rows: 3, tierId: 'recliner', seatsPerRow: 14, aislesAfter: [3, 11], seatWidth: 0.95 },
  ],
  tiers: GALAXY_TIERS,
}
