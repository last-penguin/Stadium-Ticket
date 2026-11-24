import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore, venueModel } from '../state/store'
import type { Sector } from '../venue/types'

/**
 * One translucent "blanket" per sector that floats just above the seats.
 * It is the hit-target for hovering stands in the overview and lights up
 * when hovered, which is much more forgiving than hitting individual seats.
 */
/** Ribbons floating 1 m above every row of a sector, following the seats. */
function sectorRibbon(sector: Sector, rowDepth: number) {
  const rows = new Map<number, Sector['seats']>()
  for (const seat of sector.seats) {
    const list = rows.get(seat.row) ?? []
    list.push(seat)
    rows.set(seat.row, list)
  }
  const pos: number[] = []
  const idx: number[] = []
  const half = rowDepth * 0.5
  rows.forEach((seats) => {
    const step = Math.max(1, Math.floor(seats.length / 10))
    const pts = seats.filter((_, i) => i % step === 0 || i === seats.length - 1)
    const base = pos.length / 3
    pts.forEach((seat) => {
      const fx = Math.sin(seat.rotationY)
      const fz = Math.cos(seat.rotationY)
      const [x, y, z] = seat.position
      pos.push(x + fx * half, y + 1.0, z + fz * half, x - fx * half, y + 1.0, z - fz * half)
    })
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

export function SectorOverlays() {
  const { venue } = venueModel
  const items = useMemo(
    () =>
      venue.sectors.map((sector) => {
        const geometry = sectorRibbon(sector, venue.rings[sector.ringIndex].rowDepth)
        const material = new THREE.MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        return { sector, geometry, material }
      }),
    [venue],
  )

  const meshes = useRef<(THREE.Mesh | null)[]>([])

  useEffect(() => {
    const apply = () => {
      const { mode, ringFilter, hoveredSectorId } = useStore.getState()
      items.forEach(({ sector, material }, i) => {
        const mesh = meshes.current[i]
        const enabled = mode === 'overview' && (ringFilter === null || ringFilter === sector.ringIndex)
        material.opacity = enabled && hoveredSectorId === sector.id ? 0.42 : 0
        if (mesh) mesh.raycast = enabled ? THREE.Mesh.prototype.raycast : () => {}
      })
    }
    apply()
    return useStore.subscribe((s, p) => {
      if (s.mode !== p.mode || s.ringFilter !== p.ringFilter || s.hoveredSectorId !== p.hoveredSectorId) apply()
    })
  }, [items])

  const handlers = (sector: Sector) => ({
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      const st = useStore.getState()
      st.hoverSector(sector.id)
      st.setPointer({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
      document.body.style.cursor = 'pointer'
    },
    onPointerLeave: () => {
      if (useStore.getState().hoveredSectorId === sector.id) useStore.getState().hoverSector(null)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (e.delta > 6) return
      document.body.style.cursor = ''
      useStore.getState().openSector(sector.id)
    },
  })

  return (
    <group>
      {items.map(({ sector, geometry, material }, i) => (
        <mesh
          key={sector.id}
          ref={(m) => {
            meshes.current[i] = m
          }}
          geometry={geometry}
          material={material}
          renderOrder={2}
          {...handlers(sector)}
        />
      ))}
    </group>
  )
}
