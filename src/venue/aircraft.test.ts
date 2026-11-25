import { describe, expect, it } from 'vitest'
import { buildAircraft, SKYLINER_CONFIG } from './aircraft'
import { seatBadges, seatMetrics } from './metrics'

const model = buildAircraft(SKYLINER_CONFIG)
const seats = model.venue.sectors.flatMap((s) => s.seats)
const byLabel = new Map(seats.map((s) => [s.label!, s]))

describe('aircraft layout', () => {
  it('has 4 rows of 1-2-1 suites and 30 rows of 3-3-3 economy', () => {
    expect(seats.filter((s) => s.aircraft!.suite)).toHaveLength(16)
    expect(seats.filter((s) => !s.aircraft!.suite)).toHaveLength(270)
    expect(model.venue.seatCount).toBe(286)
  })

  it('gives every seat a unique id and skips row 13', () => {
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length)
    expect(seats.some((s) => s.row === 13)).toBe(false)
  })

  it('marks window, middle and aisle seats correctly', () => {
    expect(byLabel.get('20A')!.aircraft!.place).toBe('window')
    expect(byLabel.get('20B')!.aircraft!.place).toBe('middle')
    expect(byLabel.get('20C')!.aircraft!.place).toBe('aisle')
    expect(byLabel.get('20E')!.aircraft!.place).toBe('middle')
    expect(byLabel.get('20K')!.aircraft!.place).toBe('window')
    expect(byLabel.get('20B')!.aircraft!.neighbours).toBe(2)
  })

  it('gives exit rows extra legroom and their own price tier', () => {
    const normal = byLabel.get('20C')!
    const exit = byLabel.get('26C')!
    expect(exit.aircraft!.exitRow).toBe(true)
    expect(exit.aircraft!.pitchIn).toBeGreaterThan(normal.aircraft!.pitchIn)
    const sector = model.venue.sectors.find((s) => s.id === exit.sectorId)!
    expect(sector.tierId).toBe('extra')
  })

  it('reports legroom, width and neighbour space for each seat', () => {
    const m = seatMetrics(byLabel.get('20B')!, model.venue)
    expect(m.map((x) => x.id)).toEqual(['legroom', 'width', 'neighbour'])
    expect(m[0].value).toBe(31)
    expect(m[1].value).toBe(17.5)
    expect(seatBadges(byLabel.get('1A')!)).toContain('Lie-flat suite')
  })

  it('angles window seats toward their own window and others down the cabin', () => {
    for (const label of ['20A', '20K']) {
      const w = byLabel.get(label)!
      const sideways = w.look![2] - w.eye[2]
      expect(Math.sign(sideways)).toBe(Math.sign(w.position[2])) // towards the window side
      expect(Math.abs(sideways)).toBeGreaterThan(1.5)
    }
    const a = byLabel.get('20C')!
    expect(a.look![0] - a.eye[0]).toBeGreaterThan(3)
  })
})
