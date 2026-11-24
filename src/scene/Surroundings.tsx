import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { venueModel } from '../state/store'
import type { StadiumModel } from '../venue/stadium'
import { bowlAnnulus } from './geometry'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ROAD_HALF = 9

/** Ground, plaza, roads, a park of trees and a low city skyline. */
export function Surroundings() {
  const { config, outerD } = (venueModel as StadiumModel)
  const { hx, hz, r } = config.shape
  const plazaEnd = outerD + 34
  const roadIn = plazaEnd + 16
  const roadOut = roadIn + 14

  const plaza = useMemo(() => bowlAnnulus(hx, hz, r, outerD, plazaEnd), [hx, hz, r, outerD, plazaEnd])
  const ringRoad = useMemo(() => bowlAnnulus(hx, hz, r, roadIn, roadOut), [hx, hz, r, roadIn, roadOut])
  const ringLine = useMemo(
    () => bowlAnnulus(hx, hz, r, (roadIn + roadOut) / 2 - 0.15, (roadIn + roadOut) / 2 + 0.15),
    [hx, hz, r, roadIn, roadOut],
  )

  const onRoad = (x: number, z: number, pad = 4) => Math.abs(x) < ROAD_HALF + pad || Math.abs(z) < ROAD_HALF + pad
  // rough "distance outside the bowl outline" for placement tests
  const bowlDist = (x: number, z: number) => {
    const qx = Math.max(Math.abs(x) - (hx - r), 0)
    const qz = Math.max(Math.abs(z) - (hz - r), 0)
    return Math.hypot(qx, qz) - r
  }

  const trees = useMemo(() => {
    const rand = mulberry32(42)
    const out: { x: number; z: number; s: number; c: number }[] = []
    // a neat row of trees around the plaza edge
    const N = 150
    for (let i = 0; i < N; i++) {
      const p = (venueModel as StadiumModel).bowl.point(i / N, plazaEnd + 7)
      if (onRoad(p.x, p.z, 6)) continue
      out.push({ x: p.x, z: p.z, s: 0.9 + rand() * 0.3, c: rand() })
    }
    // park and streets further out
    let tries = 0
    while (out.length < 1900 && tries < 30000) {
      tries++
      const x = (rand() - 0.5) * 1100
      const z = (rand() - 0.5) * 1100
      const bd = bowlDist(x, z)
      if (bd < roadOut + 6 || onRoad(x, z, 5)) continue
      const near = bd < 260
      if (!near && rand() > 0.35) continue
      out.push({ x, z, s: 0.7 + rand() * 0.8, c: rand() })
    }
    return out
  }, [plazaEnd, roadOut]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildings = useMemo(() => {
    const rand = mulberry32(7)
    const out: { x: number; z: number; w: number; d: number; h: number; c: number }[] = []
    let tries = 0
    while (out.length < 420 && tries < 20000) {
      tries++
      const x = (rand() - 0.5) * 1800
      const z = (rand() - 0.5) * 1800
      const bd = bowlDist(x, z)
      if (bd < 300 || onRoad(x, z, 14)) continue
      const w = 14 + rand() * 26
      const d = 14 + rand() * 26
      const h = 8 + Math.pow(rand(), 2.2) * 55
      out.push({ x: Math.round(x / 12) * 12, z: Math.round(z / 12) * 12, w, d, h, c: rand() })
    }
    return out
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)
  const buildRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const greens = ['#4f8f3f', '#5c9c46', '#3f7d39', '#6aa64f', '#47853d']
    trees.forEach((t, i) => {
      o.position.set(t.x, 1.6 * t.s, t.z)
      o.scale.set(t.s, t.s, t.s)
      o.rotation.set(0, t.c * 6, 0)
      o.updateMatrix()
      trunkRef.current!.setMatrixAt(i, o.matrix)
      o.position.set(t.x, 4.6 * t.s, t.z)
      o.scale.set(t.s * (1 + t.c * 0.3), t.s * (1.1 + t.c * 0.4), t.s * (1 + t.c * 0.3))
      o.updateMatrix()
      crownRef.current!.setMatrixAt(i, o.matrix)
      crownRef.current!.setColorAt(i, c.set(greens[Math.floor(t.c * greens.length)]))
    })
    ;[trunkRef, crownRef].forEach((r) => {
      r.current!.instanceMatrix.needsUpdate = true
      r.current!.computeBoundingSphere()
    })
    crownRef.current!.instanceColor!.needsUpdate = true

    const tones = ['#e9e7e2', '#dcdad5', '#f2f1ee', '#cfd3d8', '#e3ddd2']
    buildings.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z)
      o.scale.set(b.w, b.h, b.d)
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      buildRef.current!.setMatrixAt(i, o.matrix)
      buildRef.current!.setColorAt(i, c.set(tones[Math.floor(b.c * tones.length)]))
    })
    buildRef.current!.instanceMatrix.needsUpdate = true
    buildRef.current!.instanceColor!.needsUpdate = true
    buildRef.current!.computeBoundingSphere()
  }, [trees, buildings])

  const roadLen = 2400
  return (
    <group raycast={() => {}}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow raycast={() => {}}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#9bb487" roughness={1} />
      </mesh>
      <mesh geometry={plaza} position={[0, 0.0, 0]} receiveShadow raycast={() => {}}>
        <meshStandardMaterial color="#dcd8cf" roughness={0.95} />
      </mesh>
      <mesh geometry={ringRoad} position={[0, 0.03, 0]} receiveShadow raycast={() => {}}>
        <meshStandardMaterial color="#555b66" roughness={0.9} />
      </mesh>
      <mesh geometry={ringLine} position={[0, 0.05, 0]} raycast={() => {}}>
        <meshStandardMaterial color="#f5f2e8" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const start = (k % 2 === 0 ? hx : hz) + plazaEnd - 0.5
        const len = roadLen / 2 - start
        return (
          <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[start + len / 2, 0.02, 0]} receiveShadow raycast={() => {}}>
              <planeGeometry args={[len, ROAD_HALF * 2]} />
              <meshStandardMaterial color="#555b66" roughness={0.9} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[start + len / 2 + 8, 0.04, 0]} raycast={() => {}}>
              <planeGeometry args={[len - 16, 0.3]} />
              <meshStandardMaterial color="#f5f2e8" />
            </mesh>
          </group>
        )
      })}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow raycast={() => {}}>
        <cylinderGeometry args={[0.18, 0.28, 3.2, 5]} />
        <meshStandardMaterial color="#6b5440" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, trees.length]} castShadow receiveShadow raycast={() => {}}>
        <icosahedronGeometry args={[2.6, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={buildRef} args={[undefined, undefined, buildings.length]} castShadow receiveShadow raycast={() => {}}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </group>
  )
}
