import type { AircraftSeatInfo, PriceTier, Ring, Seat, Sector, Vec3, Venue } from './types'

// A wide-body aircraft cabin described as data. The plane points along +X
// (nose forward); rows run from the nose backwards, seats across Z. Every
// seat gets its comfort numbers (seat pitch, width, armrest, neighbours) and
// a default look direction (window seats look out of the window).

export interface AircraftCabin {
  name: string
  shortName: string
  tierId: string
  /** Seat groups across the cabin, e.g. "3-3-3" or "1-2-1". */
  layout: string
  rows: number
  firstRow: number
  pitchIn: number
  seatWidthIn: number
  /** Armrest / divider width between neighbours. */
  armrestIn: number
  /** Lie-flat suites with privacy dividers. */
  suite: boolean
  /** Rows behind an emergency exit get extra legroom. */
  exitRows: number[]
  exitExtraIn: number
  exitTierId?: string
}

export interface AircraftConfig {
  id: string
  name: string
  city: string
  /** Fuselage radius in metres. */
  radius: number
  /** Usable cabin width at seat height (m). */
  cabinWidth: number
  /** Space for galleys / toilets between cabins (m). */
  galleyLength: number
  cabins: AircraftCabin[]
  tiers: PriceTier[]
}

export interface AircraftModel {
  venue: Venue
  config: AircraftConfig
  R: number
  /** Height of the fuselage centre line above the cabin floor. */
  cy: number
  /** Cylindrical part of the fuselage, front and back x. */
  xFront: number
  xBack: number
  wing: { le: number; rootChord: number; span: number }
  /** Window centre positions along x. */
  windows: number[]
  /** x of walls between cabins. */
  partitions: number[]
}

const IN = 0.0254
const LETTERS: Record<number, string> = { 4: 'ADGK', 6: 'ABCDEF', 7: 'ABCDEFG', 8: 'ABCDEFGH', 9: 'ABCDEFGHK', 10: 'ABCDEFGHJK' }

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function buildAircraft(cfg: AircraftConfig): AircraftModel {
  const R = cfg.radius
  const cy = 1.15

  // total cabin length first, so the cabin can be centred on x = 0
  let length = 0
  cfg.cabins.forEach((c, i) => {
    if (i > 0) length += cfg.galleyLength
    length += c.rows * c.pitchIn * IN + c.exitRows.length * c.exitExtraIn * IN
  })
  const cabinFront = length / 2
  let x = cabinFront

  const rings: Ring[] = []
  const sectors: Sector[] = []
  const partitions: number[] = []
  const rowXs: { x: number; cabin: number }[] = []
  let seatCount = 0

  // First pass: x of every row (needed to place the wing before marking seats).
  const plan = cfg.cabins.map((cabin, ci) => {
    if (ci > 0) {
      partitions.push(x)
      x -= cfg.galleyLength
    }
    const pitch = cabin.pitchIn * IN
    const rows: { no: number; x: number; pitchIn: number; exit: boolean; bulkhead: boolean }[] = []
    let rowNo = cabin.firstRow
    for (let r = 0; r < cabin.rows; r++) {
      if (rowNo === 13) rowNo++ // airlines skip row 13
      const exit = cabin.exitRows.includes(rowNo)
      if (exit) x -= cabin.exitExtraIn * IN
      x -= pitch / 2
      rows.push({
        no: rowNo,
        x,
        pitchIn: Math.round(cabin.pitchIn + (exit ? cabin.exitExtraIn : 0) + (r === 0 ? 3 : 0)),
        exit,
        bulkhead: r === 0,
      })
      rowXs.push({ x, cabin: ci })
      x -= pitch / 2
      rowNo++
    }
    return rows
  })
  const cabinBack = x

  // Wing root sits over the middle of the last (largest) cabin.
  const lastRows = plan[plan.length - 1]
  const midX = lastRows[Math.floor(lastRows.length * 0.42)]?.x ?? 0
  const wing = { le: midX + 4.5, rootChord: 9.5, span: 29 }

  cfg.cabins.forEach((cabin, ci) => {
    const groups = cabin.layout.split('-').map((n) => Math.max(1, parseInt(n, 10) || 1))
    const perRow = groups.reduce((a, b) => a + b, 0)
    const letters = LETTERS[perRow] ?? 'ABCDEFGHJKLMNP'.slice(0, perRow)
    const w = cabin.seatWidthIn * IN
    const arm = cabin.armrestIn * IN
    const groupWidths = groups.map((k) => k * w + (k + 1) * arm)
    const seatsWidth = groupWidths.reduce((a, b) => a + b, 0)
    const aisle = groups.length > 1 ? Math.max(0.45, (cfg.cabinWidth - seatsWidth) / (groups.length - 1)) : 0
    const total = seatsWidth + aisle * (groups.length - 1)

    // seat z positions + place
    const cols: { z: number; letter: string; place: AircraftSeatInfo['place']; neighbours: number }[] = []
    let zc = -total / 2
    let si = 0
    groups.forEach((k, gi) => {
      for (let s = 0; s < k; s++) {
        const z = zc + arm + s * (w + arm) + w / 2
        const isWindow = si === 0 || si === perRow - 1
        const atAisle = (s === 0 && gi > 0) || (s === k - 1 && gi < groups.length - 1)
        cols.push({
          z,
          letter: letters[si] ?? String(si + 1),
          place: isWindow ? 'window' : atAisle ? 'aisle' : 'middle',
          neighbours: (s > 0 ? 1 : 0) + (s < k - 1 ? 1 : 0),
        })
        si++
      }
      zc += groupWidths[gi] + aisle
    })

    rings.push({
      index: ci,
      name: cabin.name,
      shortName: cabin.shortName,
      dStart: 0,
      rows: cabin.rows,
      rowDepth: cabin.pitchIn * IN,
      rowRise: 0,
      y0: 0,
    })

    // Sectors: split at exit rows; long runs are split into front / middle / rear.
    const rows = plan[ci]
    const chunks: { rows: typeof rows; exit: boolean }[] = []
    rows.forEach((r) => {
      const last = chunks[chunks.length - 1]
      if (!last || last.exit !== r.exit) chunks.push({ rows: [r], exit: r.exit })
      else last.rows.push(r)
    })
    const split: typeof chunks = []
    chunks.forEach((c) => {
      if (c.exit || c.rows.length <= 10) split.push(c)
      else {
        const n = Math.ceil(c.rows.length / 9)
        const size = Math.ceil(c.rows.length / n)
        for (let i = 0; i < c.rows.length; i += size) split.push({ rows: c.rows.slice(i, i + size), exit: false })
      }
    })
    const zoneNames = ['Front', 'Middle', 'Rear', 'Tail', 'Aft']
    let zoneIdx = 0
    const multi = split.filter((c) => !c.exit).length > 1

    split.forEach((chunk, k) => {
      const id = `${cabin.shortName[0].toUpperCase()}${k + 1}`
      const tierId = chunk.exit && cabin.exitTierId ? cabin.exitTierId : cabin.tierId
      const label = chunk.exit
        ? `${cabin.name} · Extra legroom`
        : multi
          ? `${cabin.name} · ${zoneNames[zoneIdx++] ?? `Zone ${zoneIdx}`}`
          : cabin.name
      const seats: Seat[] = []
      let cxs = 0
      chunk.rows.forEach((row) => {
        cols.forEach((col, c) => {
          const overWing = row.x <= wing.le + 1 && row.x >= wing.le - wing.rootChord - 1
          const side = Math.sign(col.z) || 1
          // window seats: sit a little inboard of the wall, like a real passenger
          const ez = col.place === 'window' ? col.z - side * 0.12 : col.z
          const eye: Vec3 = [row.x - 0.12, cabin.suite ? 1.08 : 1.12, ez]
          const look: Vec3 =
            col.place === 'window'
              ? (() => {
                  const d = norm(overWing ? [0.75, -0.32, side * 0.62] : [1, -0.14, side * 0.5])
                  return [eye[0] + d[0] * 5, eye[1] + d[1] * 5, eye[2] + d[2] * 5]
                })()
              : [eye[0] + 6, eye[1] - 0.25, eye[2] * 0.6]
          const sold = hash(row.no * 31 + c, ci * 7 + 3) < (cabin.suite ? 0.35 : 0.5 - (col.place === 'middle' ? 0.12 : 0))
          seats.push({
            id: `${id}-${row.no}-${col.letter}`,
            sectorId: id,
            row: row.no,
            rowLabel: String(row.no),
            number: c + 1,
            label: `${row.no}${col.letter}`,
            position: [row.x, 0, col.z],
            rotationY: Math.PI / 2,
            eye,
            look,
            accessible: false,
            status: sold ? 'sold' : 'available',
            aircraft: {
              place: col.place,
              pitchIn: row.pitchIn,
              widthIn: cabin.seatWidthIn,
              armrestIn: cabin.armrestIn,
              neighbours: cabin.suite ? 0 : col.neighbours,
              suite: cabin.suite,
              overWing,
              exitRow: row.exit,
              bulkhead: row.bulkhead,
            },
          })
        })
        cxs += row.x
      })
      seatCount += seats.length
      sectors.push({
        id,
        label,
        standName: chunk.exit ? 'Exit row' : cabin.name,
        ringIndex: ci,
        tierId,
        u0: 0,
        u1: 0,
        center: [cxs / chunk.rows.length, 0.6, 0],
        outward: [0, 0, 1],
        seats,
      })
    })
  })

  const xFront = cabinFront + 3.2
  const xBack = cabinBack - 3.2
  const windows: number[] = []
  for (let wx = cabinFront + 1.5; wx > cabinBack - 1; wx -= 0.55) {
    if (partitions.some((p) => Math.abs(p - cfg.galleyLength / 2 - wx) < cfg.galleyLength / 2 - 0.2)) continue
    windows.push(wx)
  }

  const L = xFront - xBack
  const venue: Venue = {
    id: cfg.id,
    name: cfg.name,
    city: cfg.city,
    kind: 'aircraft',
    rings,
    sectors,
    tiers: cfg.tiers.map((t) => ({ ...t })),
    focus: { centre: [0, 1, 0], goals: [] },
    view: {
      overview: {
        position: [-L * 0.3, L * 0.92, L * 0.48],
        target: [0, 0, 0],
        minDistance: 18,
        maxDistance: 160,
        maxPolar: 1.35,
      },
      sectorDistance: 9,
      sectorOffset: [-7, 11, -7],
    },
    terms: { steps: ['Cabin', 'Zone', 'Seat', 'Buy'], area: 'cabin', pickArea: 'Pick a cabin zone' },
    seatCount,
  }
  return { venue, config: cfg, R, cy, xFront, xBack, wing, windows, partitions }
}

export const SKYLINER_TIERS: PriceTier[] = [
  { id: 'first', name: 'First', price: 520000, color: '#f04a5c' },
  { id: 'extra', name: 'Extra legroom', price: 182000, color: '#d9932c' },
  { id: 'economy', name: 'Economy', price: 148000, color: '#4f8cff' },
]

export const SKYLINER_CONFIG: AircraftConfig = {
  id: 'skyliner-1',
  name: 'SeatView Air · Wide-body',
  city: 'Lahore',
  radius: 3.0,
  cabinWidth: 5.3,
  galleyLength: 2.6,
  cabins: [
    {
      name: 'First',
      shortName: 'First',
      tierId: 'first',
      layout: '1-2-1',
      rows: 4,
      firstRow: 1,
      pitchIn: 78,
      seatWidthIn: 29,
      armrestIn: 3,
      suite: true,
      exitRows: [],
      exitExtraIn: 0,
    },
    {
      name: 'Economy',
      shortName: 'Economy',
      tierId: 'economy',
      exitTierId: 'extra',
      layout: '3-3-3',
      rows: 30,
      firstRow: 10,
      pitchIn: 31,
      seatWidthIn: 17.5,
      armrestIn: 2,
      suite: false,
      exitRows: [26, 27],
      exitExtraIn: 7,
    },
  ],
  tiers: SKYLINER_TIERS,
}
