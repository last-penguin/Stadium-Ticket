// Parametric description of a stadium bowl.
//
// The inner edge of the stands is a rounded rectangle around the pitch.
// Moving `d` metres outwards keeps the straight parts the same length and
// grows the corner radius by `d`, so every row is an exact offset of the
// first one. A point on the bowl is addressed by (u, d):
//   u in [0, 1)  - position along the perimeter (fixed fractions per segment,
//                  so radial lines stay straight across all rows)
//   d >= 0       - distance outwards from the inner edge

export interface BowlShape {
  /** Half-length of the inner edge along X (behind the goals). */
  hx: number
  /** Half-width of the inner edge along Z (along the touchlines). */
  hz: number
  /** Corner radius of the inner edge. */
  r: number
}

export interface BowlPoint {
  x: number
  z: number
  /** Outward unit normal. */
  nx: number
  nz: number
}

export type SegmentKind = 'end' | 'side' | 'corner'

export interface Segment {
  kind: SegmentKind
  /** Label used for stand names. */
  name: string
  u0: number
  u1: number
}

const HALF_PI = Math.PI / 2

interface RawSegment {
  kind: SegmentKind
  name: string
  // straight: from (ax, az) to (bx, bz) with normal (nx, nz)
  ax?: number
  az?: number
  bx?: number
  bz?: number
  nx?: number
  nz?: number
  // corner: centre (cx, cz), start angle a0
  cx?: number
  cz?: number
  a0?: number
  refLength: number
}

export class Bowl {
  readonly shape: BowlShape
  readonly segments: Segment[]
  private raw: RawSegment[]

  constructor(shape: BowlShape, refD = 20) {
    this.shape = shape
    const { hx, hz, r } = shape
    const sx = hx - r // half straight length along X
    const sz = hz - r // half straight length along Z
    const cornerLen = HALF_PI * (r + refD)

    // Counter-clockwise when viewed from above (+Y), starting at the east end.
    this.raw = [
      { kind: 'end', name: 'North End', ax: hx, az: -sz, bx: hx, bz: sz, nx: 1, nz: 0, refLength: 2 * sz },
      { kind: 'corner', name: 'North-East Corner', cx: sx, cz: sz, a0: 0, refLength: cornerLen },
      { kind: 'side', name: 'East Stand', ax: sx, az: hz, bx: -sx, bz: hz, nx: 0, nz: 1, refLength: 2 * sx },
      { kind: 'corner', name: 'South-East Corner', cx: -sx, cz: sz, a0: HALF_PI, refLength: cornerLen },
      { kind: 'end', name: 'South End', ax: -hx, az: sz, bx: -hx, bz: -sz, nx: -1, nz: 0, refLength: 2 * sz },
      { kind: 'corner', name: 'South-West Corner', cx: -sx, cz: -sz, a0: Math.PI, refLength: cornerLen },
      { kind: 'side', name: 'Main Stand', ax: -sx, az: -hz, bx: sx, bz: -hz, nx: 0, nz: -1, refLength: 2 * sx },
      { kind: 'corner', name: 'North-West Corner', cx: sx, cz: -sz, a0: 3 * HALF_PI, refLength: cornerLen },
    ]

    const total = this.raw.reduce((s, g) => s + g.refLength, 0)
    let acc = 0
    this.segments = this.raw.map((g) => {
      const u0 = acc / total
      acc += g.refLength
      return { kind: g.kind, name: g.name, u0, u1: acc / total }
    })
  }

  /** Segment index that contains u. */
  segmentIndex(u: number): number {
    const uu = ((u % 1) + 1) % 1
    for (let i = 0; i < this.segments.length; i++) {
      if (uu < this.segments[i].u1 || i === this.segments.length - 1) return i
    }
    return this.segments.length - 1
  }

  point(u: number, d: number, segHint?: number): BowlPoint {
    const uu = ((u % 1) + 1) % 1
    const i = segHint ?? this.segmentIndex(uu)
    const seg = this.segments[i]
    const g = this.raw[i]
    const f = Math.min(1, Math.max(0, (uu - seg.u0) / (seg.u1 - seg.u0)))
    if (g.kind === 'corner') {
      const a = g.a0! + f * HALF_PI
      const nx = Math.cos(a)
      const nz = Math.sin(a)
      const rr = this.shape.r + d
      return { x: g.cx! + nx * rr, z: g.cz! + nz * rr, nx, nz }
    }
    const x = g.ax! + (g.bx! - g.ax!) * f + g.nx! * d
    const z = g.az! + (g.bz! - g.az!) * f + g.nz! * d
    return { x, z, nx: g.nx!, nz: g.nz! }
  }

  /** Length of the curve between u0 and u1 (same segment) at offset d. */
  arcLength(u0: number, u1: number, d: number): number {
    const i = this.segmentIndex((u0 + u1) / 2)
    const seg = this.segments[i]
    const g = this.raw[i]
    const frac = (u1 - u0) / (seg.u1 - seg.u0)
    if (g.kind === 'corner') return frac * HALF_PI * (this.shape.r + d)
    return frac * g.refLength
  }

  /**
   * Sample u values across [0, 1] that are dense on corners and include every
   * segment boundary, so extruded geometry has no kinks.
   */
  samples(cornerSteps = 14, straightSteps = 6): number[] {
    const out: number[] = []
    this.segments.forEach((seg) => {
      const steps = seg.kind === 'corner' ? cornerSteps : straightSteps
      for (let k = 0; k < steps; k++) out.push(seg.u0 + ((seg.u1 - seg.u0) * k) / steps)
    })
    out.push(1)
    return out
  }

  /** Same as samples() but restricted to [u0, u1] inside one segment. */
  samplesBetween(u0: number, u1: number, steps: number): number[] {
    const out: number[] = []
    for (let k = 0; k <= steps; k++) out.push(u0 + ((u1 - u0) * k) / steps)
    return out
  }
}
