import { useMemo } from 'react'
import * as THREE from 'three'
import { currentEvent, venueModel } from '../state/store'
import type { CinemaModel } from '../venue/cinema'

interface P {
  d: number
  y: number
}

/**
 * Sweep a (d, y) cross-section along the curved rows. d is measured from the
 * first row; each row is an arc around the screen with radius R + d. x runs
 * wall to wall so every row meets the side walls.
 */
function sweepRows(profile: P[], R: number, halfW: number, steps = 48, colors?: THREE.Color[]) {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  let base = 0
  const zAt = (x: number, d: number) => {
    if (R <= 0) return d
    const rr = R + d
    return Math.sqrt(Math.max(0, rr * rr - x * x)) - R
  }
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]
    const b = profile[i + 1]
    const c = colors?.[i]
    for (let k = 0; k <= steps; k++) {
      const x = -halfW + (2 * halfW * k) / steps
      pos.push(x, a.y, zAt(x, a.d), x, b.y, zAt(x, b.d))
      if (c) col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    for (let k = 0; k < steps; k++) {
      const j = base + 2 * k
      idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2)
    }
    base += 2 * (steps + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function movieTexture(title: string) {
  const W = 2048
  const H = 868
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#050816')
  bg.addColorStop(0.55, '#141a4a')
  bg.addColorStop(1, '#3a1450')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // stars
  for (let i = 0; i < 700; i++) {
    const r = Math.random()
    ctx.fillStyle = `rgba(255,255,255,${0.25 + r * 0.75})`
    ctx.fillRect(Math.random() * W, Math.random() * H, r * 2.2, r * 2.2)
  }
  // planet glow
  const g = ctx.createRadialGradient(W * 0.72, H * 1.35, H * 0.5, W * 0.72, H * 1.35, H * 1.05)
  g.addColorStop(0, '#ffb547')
  g.addColorStop(0.55, 'rgba(255,93,108,0.55)')
  g.addColorStop(1, 'rgba(255,93,108,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#0a0d1c'
  ctx.beginPath()
  ctx.arc(W * 0.72, H * 1.35, H * 0.62, 0, Math.PI * 2)
  ctx.fill()
  // streak
  ctx.strokeStyle = 'rgba(124,240,180,0.8)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W * 0.12, H * 0.18)
  ctx.lineTo(W * 0.42, H * 0.42)
  ctx.stroke()
  // title
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 150px "Space Grotesk Variable", "Inter Variable", sans-serif'
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '28px'
  ctx.fillText(title.toUpperCase(), W / 2, H * 0.5)
  ctx.font = '500 34px "Inter Variable", sans-serif'
  ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '10px'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('NOW SHOWING · SEATVIEW DEMO', W / 2, H * 0.62)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function CinemaHall() {
  const m = venueModel as CinemaModel
  const cfg = m.config
  const { width: W, height: H } = cfg.hall
  const R = cfg.curveRadius
  const totalRows = m.venue.rings.reduce((n, r) => n + r.rows, 0)
  const depth = cfg.rowDepth
  const frontZ = m.screenZ - 0.8
  const backZ = m.backZ + 2.2
  const hallD = backZ - frontZ

  const { floor, edges } = useMemo(() => {
    const prof: P[] = [{ d: m.screenZ + 0.8, y: 0.001 }]
    const colors: THREE.Color[] = []
    const carpet = new THREE.Color('#262a35').convertSRGBToLinear()
    const riser = new THREE.Color('#1a1d25').convertSRGBToLinear()
    colors.push(carpet)
    prof.push({ d: -0.45 * depth, y: 0.001 })
    colors.push(riser)
    const strips: P[][] = []
    for (let r = 0; r < totalRows; r++) {
      const y = cfg.firstRowHeight + r * cfg.rowRise
      prof.push({ d: (r - 0.45) * depth, y })
      colors.push(carpet)
      const end = r === totalRows - 1 ? (r + 0.55) * depth + 1.6 : (r + 0.55) * depth
      prof.push({ d: end, y })
      colors.push(riser)
      strips.push([
        { d: (r - 0.45) * depth - 0.01, y: y - 0.035 },
        { d: (r - 0.45) * depth - 0.01, y },
      ])
    }
    const last = prof[prof.length - 1]
    prof.push({ d: last.d, y: last.y + 1.1 })
    colors.push(riser)
    const floor = sweepRows(prof, R, W / 2 - 0.05, 48, colors)
    const edges = strips.map((s) => sweepRows(s, R, W / 2 - 0.05, 48))
    return { floor, edges }
  }, [m, cfg, R, W, depth, totalRows])

  const screenTex = useMemo(() => movieTexture(currentEvent.title), [])
  const sc = cfg.screen

  // Projector beam from the booth to the screen.
  const beam = useMemo(() => {
    const from = new THREE.Vector3(0, m.topY + 2.6, backZ - 0.3)
    const to = new THREE.Vector3(0, sc.bottom + sc.height / 2, m.screenZ)
    const len = from.distanceTo(to)
    const geo = new THREE.ConeGeometry(sc.width * 0.5, len, 32, 1, true)
    geo.translate(0, -len / 2, 0) // apex at origin
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize())
    return { geo, pos: from, q }
  }, [m, sc, backZ])

  return (
    <group>
      <color attach="background" args={['#07090d']} />
      <hemisphereLight args={['#b9c6ff', '#20242c', 0.5]} />
      <directionalLight position={[6, 20, 14]} intensity={0.55} color="#dfe6ff" />
      <pointLight position={[0, sc.bottom + sc.height / 2, m.screenZ + 3]} intensity={70} distance={45} decay={1.4} color="#9fb4ff" />
      <pointLight position={[0, H - 1, backZ - 4]} intensity={25} distance={30} decay={1.6} color="#ffd6a0" />

      {/* hall shell: back faces only, so the walls nearest the camera vanish (dollhouse view) */}
      <mesh position={[0, H / 2, frontZ + hallD / 2]} raycast={() => {}}>
        <boxGeometry args={[W, H, hallD]} />
        <meshStandardMaterial color="#1b1e26" roughness={0.95} side={THREE.BackSide} />
      </mesh>

      <mesh geometry={floor} raycast={() => {}}>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {edges.map((g, i) => (
        <mesh key={i} geometry={g} raycast={() => {}}>
          <meshBasicMaterial color="#7cf0b4" toneMapped={false} side={THREE.DoubleSide} transparent opacity={0.55} />
        </mesh>
      ))}

      {/* screen + black masking */}
      <mesh position={[0, sc.bottom + sc.height / 2, m.screenZ - 0.05]} raycast={() => {}}>
        <planeGeometry args={[sc.width + 1.2, sc.height + 0.9]} />
        <meshStandardMaterial color="#050608" roughness={1} />
      </mesh>
      <mesh position={[0, sc.bottom + sc.height / 2, m.screenZ]} raycast={() => {}}>
        <planeGeometry args={[sc.width, sc.height]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>

      {/* projector beam */}
      <mesh geometry={beam.geo} position={beam.pos} quaternion={beam.q} raycast={() => {}}>
        <meshBasicMaterial color="#9fb4ff" transparent opacity={0.014} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>

      {/* exit signs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 1.4), 2.6, frontZ + 0.06]} raycast={() => {}}>
          <boxGeometry args={[0.9, 0.32, 0.06]} />
          <meshBasicMaterial color="#2fe08a" toneMapped={false} />
        </mesh>
      ))}

      {/* front stage edge */}
      <mesh position={[0, 0.3, m.screenZ + 0.45]} raycast={() => {}}>
        <boxGeometry args={[W - 0.2, 0.6, 0.9]} />
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </mesh>
    </group>
  )
}
