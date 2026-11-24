import { buildCinema, type CinemaConfig, type CinemaModel } from './cinema'
import { buildStadium, type StadiumConfig, type StadiumModel } from './stadium'

export type VenueModel = StadiumModel | CinemaModel

export type VenueLayout = { kind: 'stadium'; layout: StadiumConfig } | { kind: 'cinema'; layout: CinemaConfig }

export const isStadium = (m: VenueModel): m is StadiumModel => m.venue.kind === 'stadium'
export const isCinema = (m: VenueModel): m is CinemaModel => m.venue.kind === 'cinema'

/** Build the full 3D/booking model from a stored layout, with optional event prices. */
export function buildVenue(v: VenueLayout, prices?: Record<string, number>): VenueModel {
  const model = v.kind === 'stadium' ? buildStadium(v.layout) : buildCinema(v.layout)
  if (prices) model.venue.tiers.forEach((t) => (t.price = prices[t.id] ?? t.price))
  return model
}

export const LIVERY: Record<'stadium' | 'cinema', string[]> = {
  stadium: ['#2556c4', '#1f4aa8', '#1a3f90'],
  cinema: ['#8e1b2c', '#7d1726', '#5c1220'],
}
