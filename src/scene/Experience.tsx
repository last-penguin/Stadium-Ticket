import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Sky } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore, venueModel } from '../state/store'
import { CinemaHall } from './CinemaHall'
import { CameraRig } from './CameraRig'
import { Capture } from './Capture'
import { Pitch } from './Pitch'
import { Roof } from './Roof'
import { Seats } from './Seats'
import { SectorOverlays } from './SectorOverlays'
import { StadiumBowl } from './StadiumBowl'
import { Surroundings } from './Surroundings'

/** Signals the UI once the scene has mounted and drawn a couple of frames. */
function ReadySignal() {
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => useStore.getState().setReady())
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return null
}

const SUN: [number, number, number] = [160, 230, 110]

function Lights() {
  return (
    <>
      <hemisphereLight args={['#e4edff', '#7d8f6a', 1.05]} />
      <directionalLight
        position={SUN}
        intensity={2.4}
        color="#fff4e5"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-170}
        shadow-camera-right={170}
        shadow-camera-top={170}
        shadow-camera-bottom={-170}
        shadow-camera-near={100}
        shadow-camera-far={520}
        shadow-bias={-0.0012}
        shadow-normalBias={0.9}
      />
      <ambientLight intensity={0.15} />
    </>
  )
}

function StadiumScene() {
  return (
    <>
      <color attach="background" args={['#cfdbe8']} />
      <fog attach="fog" args={['#cfdbe8', 700, 2400]} />
      <Sky sunPosition={SUN} turbidity={5} rayleigh={1.4} mieCoefficient={0.004} mieDirectionalG={0.8} distance={3500} />
      <Lights />
      <StadiumBowl />
      <Pitch />
      <Roof />
      <Surroundings />
    </>
  )
}

export function Experience() {
  const kind = venueModel.venue.kind
  const o = venueModel.venue.view.overview
  const start = o.position.map((v, i) => o.target[i] + (v - o.target[i]) * 2) as [number, number, number]
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ position: start, fov: 38, near: 0.05, far: 4000 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <Suspense fallback={null}>
        {kind === 'stadium' ? <StadiumScene /> : <CinemaHall />}
        <Seats />
        <SectorOverlays />
        <ReadySignal />
      </Suspense>
      <CameraRig />
      <Capture />
      <AdaptiveDpr pixelated={false} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO
          aoRadius={kind === 'stadium' ? 2.2 : 0.6}
          intensity={kind === 'stadium' ? 2.2 : 1.6}
          distanceFalloff={kind === 'stadium' ? 1.2 : 0.4}
          halfRes
          quality="medium"
        />
        <SMAA />
        <Vignette eskil={false} offset={0.25} darkness={0.45} />
      </EffectComposer>
    </Canvas>
  )
}
