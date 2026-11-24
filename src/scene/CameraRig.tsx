import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import * as THREE from 'three'
import { getSeat, getSector, useStore, venueModel } from '../state/store'

const { ACTION } = CameraControlsImpl


/** Camera position used to frame a whole sector from in front and above. */
export function sectorCamera(sectorId: string, fit = 1) {
  const sector = getSector(sectorId)!
  const c = new THREE.Vector3(...sector.center)
  const out = new THREE.Vector3(...sector.outward)
  const ring = venueModel.venue.rings[sector.ringIndex]
  const span = ring.rows * ring.rowDepth
  const D = venueModel.venue.view.sectorDistance
  const pos = c
    .clone()
    .addScaledVector(out, -(span * 1.6 + D) * fit)
    .add(new THREE.Vector3(0, (D * 0.62 + span * 0.5) * fit, 0))
  return { pos, target: c.clone().add(new THREE.Vector3(0, 1, 0)) }
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const { camera, size } = useThree()
  // Portrait screens see less horizontally, so pull the camera back.
  const fit = size.width / size.height < 1 ? Math.min(2.1, 1 / (size.width / size.height) ** 0.9) : 1
  const lastInteraction = useRef(performance.now())
  const token = useRef(0)

  const mode = useStore((s) => s.mode)
  const selectedSectorId = useStore((s) => s.selectedSectorId)
  const selectedSeatId = useStore((s) => s.selectedSeatId)

  // Free-orbit limits used by overview and sector views.
  const setOrbitLimits = (c: CameraControlsImpl, kind: 'overview' | 'sector') => {
    const v = venueModel.venue.view
    c.minDistance = kind === 'overview' ? v.overview.minDistance : v.sectorDistance * 0.45
    c.maxDistance = kind === 'overview' ? v.overview.maxDistance : v.sectorDistance * 6
    c.minPolarAngle = 0.12
    c.maxPolarAngle = kind === 'overview' ? v.overview.maxPolar : 1.45
    c.minAzimuthAngle = -Infinity
    c.maxAzimuthAngle = Infinity
    c.azimuthRotateSpeed = 0.6
    c.polarRotateSpeed = 0.6
    c.mouseButtons.left = ACTION.ROTATE
    c.mouseButtons.right = kind === 'sector' ? ACTION.TRUCK : ACTION.ROTATE
    c.mouseButtons.wheel = ACTION.DOLLY
    c.touches.one = ACTION.TOUCH_ROTATE
    c.touches.two = ACTION.TOUCH_DOLLY_TRUCK
    c.dollyToCursor = kind === 'sector'
  }

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const my = ++token.current
    useStore.setState({ cameraSettled: false })
    lastInteraction.current = performance.now()
    c.smoothTime = 0.55
    c.zoomTo(1, true)

    if (mode === 'overview') {
      setOrbitLimits(c, 'overview')
      const o = venueModel.venue.view.overview
      const target = new THREE.Vector3(...o.target)
      const pos = new THREE.Vector3(...o.position).sub(target).multiplyScalar(fit).add(target)
      c.setLookAt(...pos.toArray(), ...target.toArray(), true)
    } else if (mode === 'sector' && selectedSectorId) {
      // widen limits during the flight, then clamp once we arrive
      c.minDistance = 1
      c.maxDistance = 1000
      c.minPolarAngle = 0
      c.maxPolarAngle = Math.PI
      const { pos, target } = sectorCamera(selectedSectorId, fit)
      c.setLookAt(...pos.toArray(), ...target.toArray(), true).then(() => {
        if (token.current === my) setOrbitLimits(c, 'sector')
      })
    } else if (mode === 'seat' && selectedSeatId) {
      const seat = getSeat(selectedSeatId)!
      const eye = new THREE.Vector3(...seat.eye)
      // look toward a point on the pitch between the centre spot and the seat
      const screen = venueModel.venue.focus.screen
      const look = screen
        ? new THREE.Vector3(...screen.center)
        : new THREE.Vector3(seat.eye[0] * 0.18, 0, seat.eye[2] * 0.18)
      const dir = look.sub(eye).normalize()
      const target = eye.clone().addScaledVector(dir, 0.05)
      c.minDistance = 0.01
      c.maxDistance = 1000
      c.minPolarAngle = 0
      c.maxPolarAngle = Math.PI
      c.minAzimuthAngle = -Infinity
      c.maxAzimuthAngle = Infinity
      c.smoothTime = 0.75
      c.setLookAt(...eye.toArray(), ...target.toArray(), true).then(() => {
        if (token.current !== my) return
        // First-person look-around: tiny orbit radius + inverted rotate speeds.
        c.normalizeRotations()
        c.minDistance = c.maxDistance = 0.05
        const az = c.azimuthAngle
        c.minAzimuthAngle = az - 1.9
        c.maxAzimuthAngle = az + 1.9
        c.minPolarAngle = 0.5
        c.maxPolarAngle = 2.1
        c.azimuthRotateSpeed = -0.35
        c.polarRotateSpeed = -0.35
        c.mouseButtons.left = ACTION.ROTATE
        c.mouseButtons.right = ACTION.NONE
        c.mouseButtons.wheel = ACTION.ZOOM
        c.touches.one = ACTION.TOUCH_ROTATE
        c.touches.two = ACTION.TOUCH_ZOOM
        c.dollyToCursor = false
        c.smoothTime = 0.25
        useStore.setState({ cameraSettled: true })
      })
    }
  }, [mode, selectedSectorId, selectedSeatId, fit]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const onStart = () => (lastInteraction.current = performance.now())
    c.addEventListener('controlstart', onStart)
    c.addEventListener('control', onStart)
    return () => {
      c.removeEventListener('controlstart', onStart)
      c.removeEventListener('control', onStart)
    }
  }, [])

  useFrame((_, dt) => {
    const c = ref.current
    if (!c) return
    const persp = camera as THREE.PerspectiveCamera
    const targetFov = useStore.getState().mode === 'seat' ? 68 : 38
    if (Math.abs(persp.fov - targetFov) > 0.05) {
      persp.fov = THREE.MathUtils.damp(persp.fov, targetFov, 3, dt)
      persp.updateProjectionMatrix()
    }
    // Gentle idle drift in the overview, like a broadcast establishing shot.
    if (useStore.getState().mode === 'overview' && performance.now() - lastInteraction.current > 3500) {
      c.rotate(dt * 0.035, 0, false)
    }
  })

  return <CameraControls ref={ref} makeDefault />
}
