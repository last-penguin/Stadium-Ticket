import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, venueModel } from '../state/store'
import type { StadiumModel } from '../venue/stadium'
import { sweepProfile } from './geometry'

/**
 * Cantilevered roof over the upper tier. It fades to a light glass-like
 * canopy in the explorer views (so every seat stays visible from above) and
 * becomes solid in the seat view, where its shade is part of the experience.
 */
export function Roof() {
  const { bowl, roof } = (venueModel as StadiumModel)
  const us = useMemo(() => bowl.samples(20, 8), [bowl])
  const shell = useMemo(
    () =>
      sweepProfile(
        bowl,
        [
          { d: roof.dFront, y: roof.yFront - 0.9 },
          { d: roof.dFront, y: roof.yFront },
          { d: roof.dBack, y: roof.yBack },
          { d: roof.dBack, y: roof.yBack - 1.4 },
          { d: roof.dFront, y: roof.yFront - 0.9 },
        ],
        us,
      ),
    [bowl, roof, us],
  )
  const lightStrip = useMemo(
    () =>
      sweepProfile(
        bowl,
        [
          { d: roof.dFront - 0.05, y: roof.yFront - 0.85 },
          { d: roof.dFront - 0.05, y: roof.yFront - 0.25 },
        ],
        us,
      ),
    [bowl, roof, us],
  )

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f3f5f8',
        roughness: 0.55,
        metalness: 0.1,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  const shellRef = useRef<THREE.Mesh>(null)
  const stripRef = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    const target = useStore.getState().mode === 'seat' ? 1 : 0
    material.opacity = THREE.MathUtils.damp(material.opacity, target, 4, dt)
    const show = material.opacity > 0.02
    if (shellRef.current) shellRef.current.visible = show
    if (stripRef.current) stripRef.current.visible = show
    const solid = material.opacity > 0.95
    if (material.depthWrite !== solid) {
      material.depthWrite = solid
      material.transparent = !solid
      material.needsUpdate = true
    }
  })

  // Support masts behind the bowl.
  const masts = useRef<THREE.InstancedMesh>(null)
  const mastSpots = useMemo(() => {
    const out: { x: number; z: number }[] = []
    const n = 36
    for (let i = 0; i < n; i++) {
      const p = bowl.point((i + 0.5) / n, roof.dBack + 2.5)
      out.push({ x: p.x, z: p.z })
    }
    return out
  }, [bowl, roof])
  useLayoutEffect(() => {
    const mesh = masts.current!
    const o = new THREE.Object3D()
    const h = roof.yBack
    mastSpots.forEach((s, i) => {
      o.position.set(s.x, h / 2, s.z)
      o.scale.set(1, h, 1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [mastSpots, roof])

  return (
    <group>
      <mesh ref={shellRef} geometry={shell} material={material} castShadow raycast={() => {}} renderOrder={3} />
      <mesh ref={stripRef} geometry={lightStrip} raycast={() => {}} visible={false}>
        <meshStandardMaterial color="#ffffff" emissive="#fff6e0" emissiveIntensity={1.6} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh ref={masts} args={[undefined, undefined, mastSpots.length]} castShadow raycast={() => {}}>
        <cylinderGeometry args={[0.45, 0.6, 1, 10]} />
        <meshStandardMaterial color="#dfe3e8" metalness={0.3} roughness={0.4} />
      </instancedMesh>
    </group>
  )
}
