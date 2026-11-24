import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { getSeat as venueSeat, useStore, venueModel } from '../state/store'
import type { Sector } from '../venue/types'
import { isCinema, LIVERY } from '../venue/models'
import { cinemaSeatGeometry, seatGeometry, spectatorGeometry } from './geometry'

const tmp = new THREE.Object3D()
const col = new THREE.Color()
const WHITE = new THREE.Color('#ffffff')

const PALETTE = {
  soldInSector: new THREE.Color('#5d636e'),
  soldShade: new THREE.Color('#2f343d'),
  neutral: new THREE.Color('#c9cdd4'),
  neutralSold: new THREE.Color('#9aa0aa'),
  // cinema halls are dark, so "other" seats recede instead of glowing
  dark: new THREE.Color('#454b58'),
  darkSold: new THREE.Color('#2b2f38'),
  accessible: new THREE.Color('#9b7bff'),
  heldByOther: new THREE.Color('#d9942b'),
  mine: new THREE.Color('#7cf0b4'),
  compared: new THREE.Color('#ffffff'),
}

// Per-venue colour caches.
const tierCache = new WeakMap<object, Map<string, THREE.Color>>()
const tierColorsOf = () => {
  const v = venueModel.venue
  let m = tierCache.get(v)
  if (!m) {
    m = new Map(v.tiers.map((t) => [t.id, new THREE.Color(t.color)]))
    tierCache.set(v, m)
  }
  return m
}
/** "Real" seat colours used in the from-the-seat view. */
const liveryOf = () => LIVERY[venueModel.venue.kind].map((c) => new THREE.Color(c))

function computeSeatColors(sector: Sector, mesh: THREE.InstancedMesh) {
  const s = useStore.getState()
  const tier = tierColorsOf().get(sector.tierId)!
  const livery = liveryOf()
  const inFilter = s.ringFilter === null || s.ringFilter === sector.ringIndex
  const isActive = s.selectedSectorId === sector.id
  const sectorHovered = s.hoveredSectorId === sector.id
  const mine = s.myHold?.seatId

  sector.seats.forEach((seat, i) => {
    const isMine = seat.id === mine
    const held = seat.status === 'held' && !isMine
    const sold = seat.status !== 'available' && !isMine
    if (s.mode === 'seat') {
      col.copy(livery[sector.ringIndex] ?? livery[livery.length - 1])
      if (seat.id === s.selectedSeatId) col.copy(WHITE)
    } else if (s.mode === 'sector') {
      if (isActive) {
        if (isMine) col.copy(PALETTE.mine)
        else if (held) col.copy(PALETTE.heldByOther)
        else if (sold) col.copy(PALETTE.soldInSector)
        else if (s.compare.includes(seat.id)) col.copy(PALETTE.compared)
        else col.copy(seat.accessible ? PALETTE.accessible : tier)
        if (!sold && seat.id === s.hoveredSeatId) col.lerp(WHITE, 0.6)
      } else if (venueModel.venue.kind === 'cinema') {
        col.copy(sold ? PALETTE.darkSold : PALETTE.dark)
      } else {
        col.copy(sold ? PALETTE.neutralSold : PALETTE.neutral)
      }
    } else {
      if (!inFilter) col.copy(sold ? PALETTE.neutralSold : PALETTE.neutral)
      else if (sold) col.copy(tier).lerp(PALETTE.soldShade, 0.38)
      else col.copy(seat.accessible ? PALETTE.accessible : tier)
      if (sectorHovered) col.lerp(WHITE, 0.35)
    }
    mesh.setColorAt(i, col)
  })
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

/** Cinema recliners are wider than standard seats. */
function widthScale(sector: Sector) {
  const m = venueModel
  if (!isCinema(m)) return 1
  const sec = m.config.sections[sector.ringIndex]
  return sec ? sec.seatWidth / 0.62 : 1
}

export function Seats() {
  const sectors = venueModel.venue.sectors
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const geometry = useMemo(
    () => (venueModel.venue.kind === 'cinema' ? cinemaSeatGeometry() : seatGeometry(0.48)),
    [],
  )
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }), [])

  // Place every seat once.
  useLayoutEffect(() => {
    sectors.forEach((sector, si) => {
      const mesh = meshes.current[si]
      if (!mesh) return
      sector.seats.forEach((seat, i) => {
        tmp.position.set(...seat.position)
        tmp.rotation.set(0, seat.rotationY, 0)
        tmp.scale.set(widthScale(sector), 1, widthScale(sector) > 1.2 ? 1.25 : 1)
        tmp.updateMatrix()
        mesh.setMatrixAt(i, tmp.matrix)
      })
      tmp.scale.set(1, 1, 1)
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      computeSeatColors(sector, mesh)
    })
  }, [sectors])

  // Recolour and toggle interactivity in response to store changes.
  useEffect(() => {
    const indexById = new Map(sectors.map((s, i) => [s.id, i]))
    const recolor = (id: string | null) => {
      if (!id) return
      const i = indexById.get(id)
      const mesh = i === undefined ? null : meshes.current[i]
      if (mesh) computeSeatColors(sectors[i!], mesh)
    }
    const recolorAll = () => sectors.forEach((s, i) => meshes.current[i] && computeSeatColors(s, meshes.current[i]!))
    const updateRaycast = () => {
      const { mode, selectedSectorId } = useStore.getState()
      sectors.forEach((s, i) => {
        const mesh = meshes.current[i]
        if (!mesh) return
        const interactive = mode === 'sector' && s.id === selectedSectorId
        mesh.raycast = interactive ? THREE.InstancedMesh.prototype.raycast : () => {}
      })
    }
    updateRaycast()
    return useStore.subscribe((s, p) => {
      if (
        s.mode !== p.mode ||
        s.ringFilter !== p.ringFilter ||
        s.selectedSectorId !== p.selectedSectorId ||
        s.selectedSeatId !== p.selectedSeatId ||
        s.statusVersion !== p.statusVersion ||
        s.compare !== p.compare ||
        s.myHold?.seatId !== p.myHold?.seatId
      ) {
        recolorAll()
        updateRaycast()
        return
      }
      if (s.hoveredSeatId !== p.hoveredSeatId) recolor(s.selectedSectorId)
      if (s.hoveredSectorId !== p.hoveredSectorId) {
        recolor(s.hoveredSectorId)
        recolor(p.hoveredSectorId)
      }
    })
  }, [sectors])

  const handlers = (sector: Sector) => ({
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      const seat = e.instanceId !== undefined ? sector.seats[e.instanceId] : undefined
      const st = useStore.getState()
      st.hoverSeat(seat ? seat.id : null)
      st.setPointer({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
      const pickable = seat && (seat.status === 'available' || seat.id === st.myHold?.seatId)
      document.body.style.cursor = pickable ? 'pointer' : 'not-allowed'
    },
    onPointerLeave: () => {
      useStore.getState().hoverSeat(null)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (e.delta > 6 || e.instanceId === undefined) return
      const seat = sector.seats[e.instanceId]
      if (seat.status === 'available' || seat.id === useStore.getState().myHold?.seatId) {
        document.body.style.cursor = ''
        useStore.getState().openSeat(seat.id)
      }
    },
  })

  return (
    <group>
      {sectors.map((sector, i) => (
        <instancedMesh
          key={sector.id}
          ref={(m) => {
            meshes.current[i] = m
          }}
          args={[geometry, material, sector.seats.length]}
          receiveShadow
          {...handlers(sector)}
        />
      ))}
      <Spectators />
    </group>
  )
}

/** People in sold seats - only drawn in the from-the-seat view. */
function Spectators() {
  const mode = useStore((s) => s.mode)
  const selectedSeatId = useStore((s) => s.selectedSeatId)
  const ref = useRef<THREE.InstancedMesh>(null)
  const seats = useMemo(
    () => venueModel.venue.sectors.flatMap((s) => s.seats.filter((seat) => seat.status !== 'available')),
    [],
  )
  const geometry = useMemo(() => spectatorGeometry(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const shirts =
      venueModel.venue.kind === 'cinema'
        ? ['#2b2f3a', '#3a3f4d', '#5b4636', '#1e3a5f', '#6b2b35', '#d9d4c7', '#3f5a45']
        : ['#1f9d55', '#1f9d55', '#18834a', '#f4f4f0', '#2a7de1', '#1b1f2a', '#e8c547']
    seats.forEach((seat, i) => {
      tmp.position.set(...seat.position)
      tmp.rotation.set(0, seat.rotationY, 0)
      const h = Math.sin(i * 12.9898) * 43758.5453
      const r = h - Math.floor(h)
      tmp.scale.setScalar(0.92 + r * 0.16)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
      mesh.setColorAt(i, col.set(shirts[Math.floor(r * shirts.length)]))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats])

  // Hide the people right next to you so they don't fill the frame.
  const hidden = useRef<number[]>([])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    hidden.current.forEach((i) => {
      const seat = seats[i]
      tmp.position.set(...seat.position)
      tmp.rotation.set(0, seat.rotationY, 0)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    hidden.current = []
    const me = venueSeat(selectedSeatId)
    if (me) {
      seats.forEach((seat, i) => {
        const dx = seat.position[0] - me.position[0]
        const dy = seat.position[1] - me.position[1]
        const dz = seat.position[2] - me.position[2]
        if (Math.abs(dy) < 0.2 && dx * dx + dz * dz < 1.3 * 1.3) {
          mesh.setMatrixAt(i, m.makeScale(0, 0, 0))
          hidden.current.push(i)
        }
      })
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [selectedSeatId, seats])

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, seats.length]} visible={mode === 'seat'} raycast={() => {}}>
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  )
}

