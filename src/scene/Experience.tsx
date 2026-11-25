import { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Sky, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore, venueModel } from '../state/store'
import type { StadiumModel } from '../venue/stadium'
import { AircraftScene } from './AircraftScene'
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

/** Floodlit evening: moonlight, four floodlight banks on the roof aimed at the pitch. */
function NightLights() {
  const m = venueModel as StadiumModel
  const banks = useMemo(() => {
    // the middle of each corner segment, on the roof's front edge
    return m.bowl.segments
      .filter((s) => s.kind === 'corner')
      .map((s) => {
        const p = m.bowl.point((s.u0 + s.u1) / 2, m.roof.dFront)
        return [p.x, m.roof.yFront + 1.5, p.z] as [number, number, number]
      })
  }, [m])
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, 0)
    return o
  }, [])
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={['#5a6f9c', '#1b2230', 0.55]} />
      <directionalLight position={[-120, 200, -80]} intensity={0.25} color="#9fb4ff" />
      <ambientLight intensity={0.12} />
      {banks.map((p, i) => (
        <group key={i}>
          <spotLight position={p} target={target} angle={0.62} penumbra={0.55} intensity={640} decay={1.05} color="#f4f7ff" />
          {/* lamp bank */}
          <mesh position={p} raycast={() => {}}>
            <boxGeometry args={[9, 2.2, 9]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* soft fill so the stands are readable */}
      <pointLight position={[0, 70, 0]} intensity={650} decay={1.1} distance={0} color="#dfe8ff" />
    </>
  )
}

function StadiumScene() {
  const night = useStore((s) => s.night)
  if (night)
    return (
      <>
        <color attach="background" args={['#050913']} />
        <fog attach="fog" args={['#0a1020', 500, 2200]} />
        <Stars radius={1600} depth={400} count={5000} factor={7} saturation={0} fade speed={0.4} />
        <NightLights />
        <StadiumBowl />
        <Pitch />
        <Roof />
        <Surroundings night />
      </>
    )
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
  const night = useStore((s) => s.night) && kind === 'stadium'
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
        {kind === 'stadium' ? <StadiumScene /> : kind === 'cinema' ? <CinemaHall /> : <AircraftScene />}
        <Seats />
        <SectorOverlays />
        <ReadySignal />
      </Suspense>
      <CameraRig />
      <Capture />
      <AdaptiveDpr pixelated={false} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO
          aoRadius={kind === 'stadium' ? 2.2 : kind === 'aircraft' ? 0.9 : 0.6}
          intensity={kind === 'stadium' ? 2.2 : 1.6}
          distanceFalloff={kind === 'stadium' ? 1.2 : 0.4}
          halfRes
          quality="medium"
        />
        {night ? <Bloom mipmapBlur luminanceThreshold={0.85} intensity={0.9} radius={0.6} /> : <></>}
        <SMAA />
        <Vignette eskil={false} offset={0.25} darkness={0.45} />
      </EffectComposer>
    </Canvas>
  )
}
