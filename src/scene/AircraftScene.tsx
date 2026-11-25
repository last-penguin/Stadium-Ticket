import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, venueModel } from '../state/store'
import type { AircraftModel } from '../venue/aircraft'

// ---------------------------------------------------------------------------
// Fuselage shell with real window openings.
// A point on the cylinder is (x, φ): z = R cos φ, y = cy + R sin φ. Windows
// are holes at φ ≈ 0 (right side) and φ ≈ π (left side).
// ---------------------------------------------------------------------------

interface ShellOpts {
  R: number
  cy: number
  x0: number
  x1: number
  phi0: number
  phi1: number
  windows?: number[]
  winHalfX?: number
  winHalfPhi?: number
}

function shell(o: ShellOpts) {
  const { R, cy, x0, x1, phi0, phi1 } = o
  const wins = o.windows ?? []
  const hx = o.winHalfX ?? WIN_HX
  const hp = o.winHalfPhi ?? WIN_HP
  // x breakpoints: ends + every window edge
  const xs = new Set<number>([x0, x1])
  wins.forEach((w) => {
    xs.add(w - hx)
    xs.add(w + hx)
  })
  const xb = [...xs].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b)
  // φ breakpoints: uniform + window band edges
  const ps = new Set<number>()
  const steps = Math.max(4, Math.ceil(((phi1 - phi0) / (Math.PI * 2)) * 64))
  for (let i = 0; i <= steps; i++) ps.add(phi0 + ((phi1 - phi0) * i) / steps)
  for (const c of [0, Math.PI, Math.PI * 2]) {
    for (const e of [c - hp, c + hp]) if (e > phi0 && e < phi1) ps.add(e)
  }
  const pb = [...ps].sort((a, b) => a - b)
  const inBand = (p: number) => {
    const m = ((p % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    return m < hp || m > Math.PI * 2 - hp || Math.abs(m - Math.PI) < hp
  }
  const inWindowX = (x: number) => wins.some((w) => x > w - hx && x < w + hx)

  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const vert = (x: number, p: number) => {
    pos.push(x, cy + R * Math.sin(p), R * Math.cos(p))
    nor.push(0, Math.sin(p), Math.cos(p))
    return pos.length / 3 - 1
  }
  for (let i = 0; i < xb.length - 1; i++) {
    const xa = xb[i]
    const xc = xb[i + 1]
    const holeX = inWindowX((xa + xc) / 2)
    for (let j = 0; j < pb.length - 1; j++) {
      const pa = pb[j]
      const pc = pb[j + 1]
      if (holeX && inBand((pa + pc) / 2)) continue
      const a = vert(xa, pa)
      const b = vert(xc, pa)
      const c = vert(xc, pc)
      const d = vert(xa, pc)
      idx.push(a, c, b, a, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

function cloudTexture(seed: number) {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 140; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const r = 30 + rnd() * 110
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
        g.addColorStop(0, 'rgba(255,255,255,0.55)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
      }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(5, 5)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Clouds() {
  const a = useMemo(() => cloudTexture(7), [])
  const b = useMemo(() => cloudTexture(99), [])
  useFrame((_, dt) => {
    // the plane is flying forward (+x), so clouds drift backwards
    a.offset.x -= dt * 0.006
    b.offset.x -= dt * 0.011
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -140, 0]} raycast={() => {}}>
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial color="#9cb7d6" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -110, 0]} raycast={() => {}}>
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial map={a} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -70, 0]} raycast={() => {}}>
        <planeGeometry args={[5000, 5000]} />
        <meshBasicMaterial map={b} transparent depthWrite={false} opacity={0.85} />
      </mesh>
    </group>
  )
}

/** Rounded plastic frame around a window, seen from inside the cabin. */
function bezelGeometry() {
  const rr = (s: THREE.Shape | THREE.Path, w: number, h: number, r: number) => {
    s.moveTo(-w + r, -h)
    s.lineTo(w - r, -h)
    s.quadraticCurveTo(w, -h, w, -h + r)
    s.lineTo(w, h - r)
    s.quadraticCurveTo(w, h, w - r, h)
    s.lineTo(-w + r, h)
    s.quadraticCurveTo(-w, h, -w, h - r)
    s.lineTo(-w, -h + r)
    s.quadraticCurveTo(-w, -h, -w + r, -h)
    return s
  }
  const outer = rr(new THREE.Shape(), 0.24, 0.31, 0.12) as THREE.Shape
  outer.holes.push(rr(new THREE.Path(), 0.125, 0.18, 0.09) as THREE.Path)
  return new THREE.ShapeGeometry(outer, 8)
}

function Bezels({ windows, R, cy }: { windows: number[]; R: number; cy: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => bezelGeometry(), [])
  useEffect(() => {
    const mesh = ref.current!
    const o = new THREE.Object3D()
    let i = 0
    for (const x of windows)
      for (const side of [1, -1]) {
        o.position.set(x, cy, side * (R - 0.03))
        // shape lies in XY; turn it to face the cabin (normal pointing to -side*z)
        o.rotation.set(0, side === 1 ? Math.PI : 0, 0)
        o.updateMatrix()
        mesh.setMatrixAt(i++, o.matrix)
      }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [windows, R, cy])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, windows.length * 2]} raycast={() => {}}>
      <meshStandardMaterial color="#f7f5f0" roughness={0.55} side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function wingGeometry(le: number, rootZ: number, rootChord: number, span: number, sweep: number, tipChord: number, thick: number) {
  const s = new THREE.Shape()
  s.moveTo(le, rootZ)
  s.lineTo(le - sweep, rootZ + span)
  s.lineTo(le - sweep - tipChord, rootZ + span)
  s.lineTo(le - rootChord, rootZ)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: 0.12, bevelSegments: 2 })
  g.rotateX(Math.PI / 2) // shape y -> world z, extrude -> world -y
  g.translate(0, thick / 2, 0)
  g.computeVertexNormals()
  return g
}

const WHITE = '#f4f6f9'
/** Window opening: half width along the cabin (m) and half height as an angle. */
const WIN_HX = 0.12
const WIN_HP = 0.058
const WALL = '#ece8df'

export function AircraftScene() {
  const m = venueModel as AircraftModel
  const { R, cy, xFront, xBack, windows, wing, partitions } = m
  const cabinFront = Math.max(...m.venue.sectors.flatMap((s) => s.seats.map((x) => x.position[0]))) + 1.4
  const cabinBack = Math.min(...m.venue.sectors.flatMap((s) => s.seats.map((x) => x.position[0]))) - 1.2
  const len = xFront - xBack
  const midX = (xFront + xBack) / 2
  const phiC = Math.asin(0.92 / R) // roof cut sits just above the windows

  const geo = useMemo(() => {
    const lower = shell({ R, cy, x0: xBack, x1: xFront, phi0: Math.PI - phiC, phi1: Math.PI * 2 + phiC, windows })
    const right = shell({ R, cy, x0: xBack, x1: xFront, phi0: phiC, phi1: Math.PI / 2 })
    const left = shell({ R, cy, x0: xBack, x1: xFront, phi0: Math.PI / 2, phi1: Math.PI - phiC })
    const stripeR = shell({ R: R + 0.012, cy, x0: xBack - 0.2, x1: xFront, phi0: -0.24, phi1: -0.16 })
    const stripeL = shell({ R: R + 0.012, cy, x0: xBack - 0.2, x1: xFront, phi0: Math.PI + 0.16, phi1: Math.PI + 0.24 })
    // nose and tail cones (lathe around the fuselage axis)
    const nosePts: THREE.Vector2[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      nosePts.push(new THREE.Vector2(R * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.04 * t), t * 7))
    }
    const nose = new THREE.LatheGeometry(nosePts, 48)
    const tailPts: THREE.Vector2[] = []
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      tailPts.push(new THREE.Vector2(R * (1 - t * 0.82) + 0.0001, t * 12))
    }
    const tail = new THREE.LatheGeometry(tailPts, 48)
    const wingR = wingGeometry(wing.le, R * 0.55, wing.rootChord, wing.span, 17, 2.6, 0.45)
    const stab = wingGeometry(xBack - 4.5, 0.3, 5.5, 9, 5, 1.8, 0.25)
    // vertical fin
    const fin = new THREE.Shape()
    fin.moveTo(0, 0)
    fin.lineTo(-7.5, 9.5)
    fin.lineTo(-10.5, 9.5)
    fin.lineTo(-10.5, 0)
    fin.closePath()
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 2 })
    finGeo.translate(0, 0, -0.18)
    return { lower, right, left, stripeR, stripeL, nose, tail, wingR, stab, finGeo }
  }, [R, cy, xBack, xFront, windows, wing, phiC])

  // --- roof opening ----------------------------------------------------------
  const rightRef = useRef<THREE.Group>(null)
  const leftRef = useRef<THREE.Group>(null)
  const centreRef = useRef<THREE.Group>(null)
  const open = useRef(0)
  const introAt = useRef(performance.now())
  const ready = useStore((s) => s.ready)
  useEffect(() => {
    if (ready) introAt.current = performance.now()
  }, [ready])

  useFrame((_, dt) => {
    const { mode, ready } = useStore.getState()
    const introDone = ready && performance.now() - introAt.current > 1300
    const target = mode === 'seat' ? 0 : introDone ? 1 : 0
    open.current = THREE.MathUtils.damp(open.current, target, mode === 'seat' ? 3.5 : 1.8, dt)
    const a = open.current * 1.9
    if (rightRef.current) rightRef.current.rotation.x = a
    if (leftRef.current) leftRef.current.rotation.x = -a
    if (centreRef.current) {
      centreRef.current.position.y = open.current * 6
      centreRef.current.visible = open.current < 0.35
    }
  })

  const hingeY = cy + R * Math.sin(phiC)
  const hingeZ = R * Math.cos(phiC)
  const binLen = cabinFront - cabinBack

  const crownHalf = (side: 1 | -1, geom: THREE.BufferGeometry) => (
    <group ref={side === 1 ? rightRef : leftRef} position={[0, hingeY, side * hingeZ]}>
      <group position={[0, -hingeY, -side * hingeZ]}>
        <mesh geometry={geom} raycast={() => {}}>
          <meshStandardMaterial color={WHITE} roughness={0.35} metalness={0.15} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={geom} raycast={() => {}}>
          <meshStandardMaterial color={WALL} roughness={0.9} side={THREE.BackSide} />
        </mesh>
        {/* overhead bins */}
        <mesh position={[(cabinFront + cabinBack) / 2, 2.15, side * 2.2]} raycast={() => {}}>
          <boxGeometry args={[binLen, 0.5, 0.75]} />
          <meshStandardMaterial color="#f3f0ea" roughness={0.6} />
        </mesh>
        <mesh position={[(cabinFront + cabinBack) / 2, 1.88, side * 1.86]} raycast={() => {}}>
          <boxGeometry args={[binLen, 0.03, 0.05]} />
          <meshBasicMaterial color="#a9b8ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )

  return (
    <group>
      <color attach="background" args={['#8fb5e3']} />
      <fog attach="fog" args={['#cbdcf0', 220, 1400]} />
      <Sky sunPosition={[220, 140, -160]} turbidity={3} rayleigh={0.9} mieCoefficient={0.003} mieDirectionalG={0.85} distance={4000} />
      <hemisphereLight args={['#eef4ff', '#a6b3c6', 1.25]} />
      <directionalLight position={[120, 160, -90]} intensity={2.1} color="#fff6ea" />
      <ambientLight intensity={0.25} />
      <Clouds />

      {/* static lower fuselage with window openings */}
      <mesh geometry={geo.lower} raycast={() => {}}>
        <meshStandardMaterial color={WHITE} roughness={0.35} metalness={0.15} side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={geo.lower} raycast={() => {}}>
        <meshStandardMaterial color={WALL} roughness={0.9} side={THREE.BackSide} />
      </mesh>
      <Bezels windows={windows} R={R} cy={cy} />
      <mesh geometry={geo.stripeR} raycast={() => {}}>
        <meshStandardMaterial color="#1f6fd1" roughness={0.4} />
      </mesh>
      <mesh geometry={geo.stripeL} raycast={() => {}}>
        <meshStandardMaterial color="#1f6fd1" roughness={0.4} />
      </mesh>

      {/* roof halves swing open like a clamshell */}
      {crownHalf(1, geo.right)}
      {crownHalf(-1, geo.left)}

      {/* ceiling + centre bins lift away when the roof opens */}
      <group ref={centreRef}>
        <mesh position={[(cabinFront + cabinBack) / 2, 2.5, 0]} raycast={() => {}}>
          <boxGeometry args={[binLen, 0.05, 2.6]} />
          <meshStandardMaterial color="#f5f3ee" roughness={0.8} />
        </mesh>
        <mesh position={[(cabinFront + cabinBack) / 2, 2.2, 0]} raycast={() => {}}>
          <boxGeometry args={[binLen, 0.45, 1.5]} />
          <meshStandardMaterial color="#f3f0ea" roughness={0.6} />
        </mesh>
        <mesh position={[(cabinFront + cabinBack) / 2, 2.47, 1.0]} raycast={() => {}}>
          <boxGeometry args={[binLen, 0.03, 0.06]} />
          <meshBasicMaterial color="#a9b8ff" toneMapped={false} />
        </mesh>
        <mesh position={[(cabinFront + cabinBack) / 2, 2.47, -1.0]} raycast={() => {}}>
          <boxGeometry args={[binLen, 0.03, 0.06]} />
          <meshBasicMaterial color="#a9b8ff" toneMapped={false} />
        </mesh>
      </group>

      {/* cabin floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(xFront + xBack) / 2, 0.002, 0]} raycast={() => {}}>
        <planeGeometry args={[len, 5.6]} />
        <meshStandardMaterial color="#39435c" roughness={1} />
      </mesh>
      {/* galleys between cabins and at the ends */}
      {partitions.map((p) => (
        <group key={p}>
          <mesh position={[p - m.config.galleyLength / 2, 1.05, 0]} raycast={() => {}}>
            <boxGeometry args={[m.config.galleyLength - 0.7, 2.1, 1.5]} />
            <meshStandardMaterial color="#e2ddd3" roughness={0.7} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[p - 0.05, 1.05, s * 2.15]} raycast={() => {}}>
              <boxGeometry args={[0.08, 2.1, 1.0]} />
              <meshStandardMaterial color="#d8d2c6" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[cabinFront + 1.2, 1.05, 0]} raycast={() => {}}>
        <boxGeometry args={[1.6, 2.1, 4.6]} />
        <meshStandardMaterial color="#e2ddd3" roughness={0.7} />
      </mesh>
      {/* bulkhead screens facing the front row */}
      {[-1.25, 1.25].map((z) => (
        <group key={z} position={[cabinFront + 0.38, 1.45, z]}>
          <mesh rotation={[0, -Math.PI / 2, 0]} raycast={() => {}}>
            <planeGeometry args={[0.95, 0.55]} />
            <meshBasicMaterial color="#0f1f3a" toneMapped={false} />
          </mesh>
          <mesh position={[-0.005, -0.12, 0]} rotation={[0, -Math.PI / 2, 0]} raycast={() => {}}>
            <planeGeometry args={[0.7, 0.04]} />
            <meshBasicMaterial color="#7cf0b4" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[cabinBack - 1.2, 1.05, 0]} raycast={() => {}}>
        <boxGeometry args={[1.6, 2.1, 4.6]} />
        <meshStandardMaterial color="#e2ddd3" roughness={0.7} />
      </mesh>

      {/* nose & tail cones */}
      <mesh geometry={geo.nose} position={[xFront, cy, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={() => {}}>
        <meshStandardMaterial color={WHITE} roughness={0.35} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[xFront + 5.0, cy + 1.3, 0]} rotation={[0, 0, -0.55]} raycast={() => {}}>
        <boxGeometry args={[1.1, 0.32, 2.3]} />
        <meshStandardMaterial color="#14202e" roughness={0.15} metalness={0.6} />
      </mesh>
      <mesh geometry={geo.tail} position={[xBack, cy, 0]} rotation={[0, 0, Math.PI / 2 - 0.07]} raycast={() => {}}>
        <meshStandardMaterial color={WHITE} roughness={0.35} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* tail fin with the SeatView mark */}
      <mesh geometry={geo.finGeo} position={[xBack - 1.5, cy + R * 0.7, 0]} raycast={() => {}}>
        <meshStandardMaterial color="#132036" roughness={0.4} />
      </mesh>
      <mesh position={[xBack - 8.2, cy + R * 0.7 + 5.4, 0]} rotation={[0, 0, 0]} raycast={() => {}}>
        <torusGeometry args={[1.25, 0.28, 12, 40]} />
        <meshStandardMaterial color="#7cf0b4" emissive="#7cf0b4" emissiveIntensity={0.25} />
      </mesh>

      {/* wings, engines, stabilisers */}
      {[1, -1].map((s) => (
        <group key={s} scale={[1, 1, s]}>
          <group position={[0, cy - R * 0.62, 0]} rotation={[-0.09, 0, 0]}>
            <mesh geometry={geo.wingR} raycast={() => {}}>
              <meshStandardMaterial color="#dfe4ea" roughness={0.45} metalness={0.3} side={THREE.DoubleSide} />
            </mesh>
            <group position={[wing.le + 1.2, -1.65, R * 0.55 + 8.5]}>
              <mesh rotation={[0, 0, Math.PI / 2]} raycast={() => {}}>
                <cylinderGeometry args={[1.35, 1.2, 5.2, 32, 1, true]} />
                <meshStandardMaterial color="#e9edf2" roughness={0.35} metalness={0.35} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[2.45, 0, 0]} rotation={[0, 0, Math.PI / 2]} raycast={() => {}}>
                <circleGeometry args={[1.28, 32]} />
                <meshStandardMaterial color="#1a1f28" roughness={0.6} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[-1.2, 1.15, 0]} raycast={() => {}}>
                <boxGeometry args={[3.2, 0.9, 0.35]} />
                <meshStandardMaterial color="#dfe4ea" roughness={0.45} metalness={0.3} />
              </mesh>
            </group>
          </group>
          <group position={[0, cy + 0.2, 0]} rotation={[-0.05, 0, 0]}>
            <mesh geometry={geo.stab} raycast={() => {}}>
              <meshStandardMaterial color="#dfe4ea" roughness={0.45} metalness={0.3} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
      {/* keep the camera target meaningful */}
      <group position={[midX, 0, 0]} />
    </group>
  )
}
