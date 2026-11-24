import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { venueModel } from '../state/store'
import type { StadiumModel } from '../venue/stadium'
import type { ProfileKind } from '../venue/stadium'
import { sweepProfile } from './geometry'

const KIND_COLORS: Record<ProfileKind, string> = {
  floor: '#a9b0a3',
  wall: '#2a303c',
  tread: '#d4d7dc',
  riser: '#9ea4ad',
  concourse: '#c3c7cd',
  fascia: '#1f2430',
  rim: '#eef0f3',
  outer: '#eef0f3',
}

/** Concrete terraces of all tiers, swept along the bowl outline. */
export function StadiumBowl() {
  const geometry = useMemo(() => {
    const { bowl, profile } = (venueModel as StadiumModel)
    const colors = profile.map((p) => new THREE.Color(KIND_COLORS[p.kind]).convertSRGBToLinear())
    return sweepProfile(bowl, profile, bowl.samples(20, 8), (i) => colors[i])
  }, [])

  // LED ribbon boards on the fascia in front of the middle and upper tiers.
  const ribbons = useMemo(() => {
    const { bowl, venue } = (venueModel as StadiumModel)
    return venue.rings.slice(1).map((ring) => {
      const d = ring.dStart - 0.22
      const prev = venue.rings[ring.index - 1]
      const prevTop = prev.y0 + (prev.rows - 1) * prev.rowRise
      const y0 = prevTop + (ring.y0 - prevTop) * 0.35
      const y1 = ring.y0 + 0.75
      return sweepProfile(bowl, [{ d, y: y0 }, { d, y: y1 }], bowl.samples(20, 8))
    })
  }, [])

  // Vertical glass slots around the outer facade.
  const fins = useRef<THREE.InstancedMesh>(null)
  const finSpots = useMemo(() => {
    const { bowl, outerD } = (venueModel as StadiumModel)
    const n = 260
    return Array.from({ length: n }, (_, i) => {
      const p = bowl.point((i + 0.5) / n, outerD + 0.86)
      return { x: p.x, z: p.z, ry: Math.atan2(p.nx, p.nz) }
    })
  }, [])
  useLayoutEffect(() => {
    const mesh = fins.current!
    const o = new THREE.Object3D()
    const h = (venueModel as StadiumModel).rimY - 5
    finSpots.forEach((f, i) => {
      o.position.set(f.x, 2.5 + h / 2, f.z)
      o.rotation.set(0, f.ry, 0)
      o.scale.set(1.1, h, 0.12)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [finSpots])

  return (
    <group>
      <instancedMesh ref={fins} args={[undefined, undefined, finSpots.length]} raycast={() => {}}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2c3646" roughness={0.25} metalness={0.4} />
      </instancedMesh>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {ribbons.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial
            color="#0d1220"
            emissive={i === 0 ? '#3d7bff' : '#7cf0b4'}
            emissiveIntensity={0.55}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
