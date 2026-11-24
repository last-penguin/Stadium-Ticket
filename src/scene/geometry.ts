import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Bowl } from '../venue/bowl'

export interface Profile2D {
  d: number
  y: number
}

/**
 * Sweep a 2D cross-section (d = outwards, y = up) along the bowl perimeter.
 * Each profile segment becomes its own strip so hard edges between treads and
 * risers stay crisp, while normals are smooth around the corners.
 */
export function sweepProfile(
  bowl: Bowl,
  profile: Profile2D[],
  us: number[],
  colorFor?: (segmentIndex: number) => THREE.Color,
  closed = false,
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  let base = 0
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]
    const b = profile[i + 1]
    if (Math.abs(a.d - b.d) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) continue
    const c = colorFor?.(i)
    for (let j = 0; j < us.length; j++) {
      const pa = bowl.point(us[j], a.d)
      const pb = bowl.point(us[j], b.d)
      positions.push(pa.x, a.y, pa.z, pb.x, b.y, pb.z)
      if (c) colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    const n = us.length
    const last = closed ? n : n - 1
    for (let j = 0; j < last; j++) {
      const j0 = base + 2 * j
      const j1 = base + 2 * ((j + 1) % n)
      indices.push(j0, j1, j0 + 1, j0 + 1, j1, j1 + 1)
    }
    base += 2 * n
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (colors.length) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Rounded rectangle path in the XZ plane (as a Shape in X / -Z). */
export function roundedRectShape<T extends THREE.Path = THREE.Shape>(
  hx: number,
  hz: number,
  r: number,
  shape: T = new THREE.Shape() as unknown as T,
): T {
  shape.moveTo(-hx + r, -hz)
  shape.lineTo(hx - r, -hz)
  shape.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(hx, hz - r)
  shape.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-hx + r, hz)
  shape.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-hx, -hz + r)
  shape.absarc(-hx + r, -hz + r, r, Math.PI, 1.5 * Math.PI, false)
  return shape
}

/** A flat ring between two offsets of the bowl outline, lying on the ground. */
export function bowlAnnulus(hx: number, hz: number, r: number, d0: number, d1: number) {
  const outer = roundedRectShape(hx + d1, hz + d1, r + d1)
  const hole = roundedRectShape(hx + d0, hz + d0, r + d0, new THREE.Path())
  outer.holes.push(hole)
  const g = new THREE.ShapeGeometry(outer, 24)
  g.rotateX(-Math.PI / 2)
  return g
}

/** Low-poly stadium seat facing +Z, origin at the floor under the seat. */
export function seatGeometry(width = 0.48) {
  const pan = new THREE.BoxGeometry(width, 0.07, 0.4)
  pan.translate(0, 0.43, 0.04)
  const back = new THREE.BoxGeometry(width, 0.46, 0.06)
  back.rotateX(-0.12)
  back.translate(0, 0.68, -0.17)
  const g = mergeGeometries([pan, back])!
  g.computeBoundingSphere()
  return g
}

/** Simple seated spectator (torso + head) facing +Z. */
export function spectatorGeometry() {
  const torso = new THREE.CylinderGeometry(0.12, 0.17, 0.5, 8, 1)
  torso.translate(0, 0.76, -0.08)
  const head = new THREE.SphereGeometry(0.1, 8, 6)
  head.translate(0, 1.13, -0.06)
  const legs = new THREE.BoxGeometry(0.3, 0.12, 0.36)
  legs.translate(0, 0.5, 0.12)
  const g = mergeGeometries([torso, head, legs])!
  return g
}

/** Standing footballer, ~1.8 m tall, facing +Z. */
export function playerGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.1, 0.1]) {
    const leg = new THREE.CylinderGeometry(0.065, 0.055, 0.85, 6)
    leg.translate(x, 0.43, 0)
    parts.push(leg)
  }
  const shorts = new THREE.CylinderGeometry(0.2, 0.19, 0.22, 8)
  shorts.translate(0, 0.9, 0)
  const torso = new THREE.CylinderGeometry(0.2, 0.17, 0.55, 8)
  torso.translate(0, 1.27, 0)
  const head = new THREE.SphereGeometry(0.11, 10, 8)
  head.translate(0, 1.67, 0)
  parts.push(shorts, torso, head)
  const g = mergeGeometries(parts)!
  return g
}

/** Padded cinema seat with armrests, facing +Z, ~0.6 m wide. */
export function cinemaSeatGeometry() {
  const cushion = new THREE.BoxGeometry(0.5, 0.14, 0.5)
  cushion.translate(0, 0.42, 0.05)
  const back = new THREE.BoxGeometry(0.52, 0.72, 0.12)
  back.rotateX(-0.16)
  back.translate(0, 0.82, -0.22)
  const parts = [cushion, back]
  for (const x of [-0.29, 0.29]) {
    const arm = new THREE.BoxGeometry(0.07, 0.22, 0.56)
    arm.translate(x, 0.6, 0)
    const leg = new THREE.BoxGeometry(0.07, 0.5, 0.42)
    leg.translate(x, 0.25, 0)
    parts.push(arm, leg)
  }
  const g = mergeGeometries(parts)!
  g.computeBoundingSphere()
  return g
}
