import type { Seat, Sector, Venue } from './types'

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const DEG = 180 / Math.PI

export interface Metric {
  id: string
  label: string
  value: number
  unit: 'm' | '°'
  /** Which direction is better when comparing seats. */
  better: 'low' | 'high' | 'none'
}

export const formatMetric = (m: Metric) => `${Math.round(m.value)}${m.unit === 'm' ? ' m' : '°'}`

/** The three headline numbers shown on the seat card, per venue type. */
export function seatMetrics(seat: Seat, venue: Venue): Metric[] {
  if (venue.kind === 'cinema' && venue.focus.screen) {
    const sc = venue.focus.screen
    const horiz = Math.abs(seat.eye[2] - sc.center[2])
    return [
      { id: 'screen', label: 'to the screen', value: dist(seat.eye, sc.center), unit: 'm', better: 'none' },
      { id: 'angle', label: 'screen width in view', value: 2 * Math.atan(sc.width / 2 / horiz) * DEG, unit: '°', better: 'none' },
      { id: 'offset', label: 'from the centre line', value: Math.abs(seat.eye[0]), unit: 'm', better: 'low' },
    ]
  }
  return [
    { id: 'centre', label: 'to the centre spot', value: dist(seat.eye, venue.focus.centre), unit: 'm', better: 'low' },
    { id: 'height', label: 'above the pitch', value: seat.eye[1], unit: 'm', better: 'none' },
    {
      id: 'goal',
      label: 'to the nearest goal',
      value: Math.min(...venue.focus.goals.map((g) => dist(seat.eye, g))),
      unit: 'm',
      better: 'low',
    },
  ]
}

export function sectorAvailability(sector: Sector) {
  let free = 0
  let accessible = 0
  for (const s of sector.seats) {
    if (s.status === 'available') {
      free++
      if (s.accessible) accessible++
    }
  }
  return { free, total: sector.seats.length, accessible }
}

/**
 * A simple 0-100 "view score".
 * Stadium: closer is better, sideline beats behind-the-goal, very low or very
 * high seats lose a few points.
 * Cinema: the screen should fill about 40° of your view (cinema guidelines
 * recommend roughly 36-40°), you should sit near the centre line, and not have
 * to look up steeply.
 */
export function viewScore(seat: Seat, venue: Venue): { score: number; label: string } {
  let penalty = 0
  if (venue.kind === 'cinema' && venue.focus.screen) {
    const sc = venue.focus.screen
    const horiz = Math.abs(seat.eye[2] - sc.center[2])
    const angle = 2 * Math.atan(sc.width / 2 / horiz) * DEG
    const lookUp = Math.atan2(sc.center[1] - seat.eye[1], horiz) * DEG
    penalty += Math.abs(angle - 40) * 1.1
    penalty += Math.abs(seat.eye[0]) * 3.2
    penalty += Math.max(0, lookUp - 6) * 1.6
  } else {
    const [x, , z] = seat.eye
    const toCentre = dist(seat.eye, venue.focus.centre)
    const side = Math.abs(z) / Math.max(1, Math.hypot(x, z))
    penalty += Math.max(0, toCentre - 35) * 0.55
    penalty += (1 - side) * 18
    if (seat.eye[1] < 5) penalty += (5 - seat.eye[1]) * 2.5
    if (seat.eye[1] > 25) penalty += (seat.eye[1] - 25) * 0.6
  }
  const score = Math.round(Math.min(99, Math.max(35, 100 - penalty)))
  const label = score >= 85 ? 'Excellent' : score >= 72 ? 'Great' : score >= 60 ? 'Good' : 'Fair'
  return { score, label }
}
