import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { venueModel } from '../state/store'
import type { StadiumModel } from '../venue/stadium'
import { bowlAnnulus, playerGeometry, roundedRectShape } from './geometry'

const PX = 16 // texture pixels per metre

function drawPitchTexture(length: number, width: number, margin: number) {
  const W = Math.round((length + margin * 2) * PX)
  const H = Math.round((width + margin * 2) * PX)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // mowing stripes
  const stripes = 18
  const sw = W / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#3f9a4b' : '#47a855'
    ctx.fillRect(i * sw, 0, sw + 1, H)
  }
  // subtle noise for texture
  const img = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)

  const m = (v: number) => v * PX
  const ox = m(margin)
  const oy = m(margin)
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = m(0.14)
  const L = m(length)
  const Wd = m(width)
  const cy = oy + Wd / 2
  ctx.strokeRect(ox, oy, L, Wd)
  ctx.beginPath()
  ctx.moveTo(ox + L / 2, oy)
  ctx.lineTo(ox + L / 2, oy + Wd)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(ox + L / 2, cy, m(9.15), 0, Math.PI * 2)
  ctx.stroke()
  const dot = (x: number, y: number) => {
    ctx.beginPath()
    ctx.arc(x, y, m(0.25), 0, Math.PI * 2)
    ctx.fill()
  }
  dot(ox + L / 2, cy)
  for (const side of [0, 1]) {
    const dir = side ? -1 : 1
    const gx = side ? ox + L : ox
    // penalty area
    ctx.strokeRect(side ? gx - m(16.5) : gx, cy - m(20.16), m(16.5), m(40.32))
    // goal area
    ctx.strokeRect(side ? gx - m(5.5) : gx, cy - m(9.16), m(5.5), m(18.32))
    // penalty spot + arc
    const px = gx + dir * m(11)
    dot(px, cy)
    const a = Math.acos(5.5 / 9.15)
    ctx.beginPath()
    if (side) ctx.arc(px, cy, m(9.15), Math.PI - a, Math.PI + a)
    else ctx.arc(px, cy, m(9.15), -a, a)
    ctx.stroke()
  }
  // corner arcs
  const corners: [number, number, number][] = [
    [ox, oy, 0],
    [ox + L, oy, Math.PI / 2],
    [ox + L, oy + Wd, Math.PI],
    [ox, oy + Wd, 1.5 * Math.PI],
  ]
  corners.forEach(([x, y, a]) => {
    ctx.beginPath()
    ctx.arc(x, y, m(1), a, a + Math.PI / 2)
    ctx.stroke()
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function Goal({ x }: { x: number }) {
  const dir = Math.sign(x)
  const w = 7.32
  const h = 2.44
  const depth = 2
  const r = 0.07
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, h / 2, -w / 2]} castShadow>
        <cylinderGeometry args={[r, r, h, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, h / 2, w / 2]} castShadow>
        <cylinderGeometry args={[r, r, h, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, w, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* net */}
      <mesh position={[dir * depth, h * 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[dir * depth * 0.5, h, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[depth, w]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** 22 players + ball standing in a kick-off-ish formation. */
function Players() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => playerGeometry(), [])
  const spots = useMemo(() => {
    const f = [
      [-50, 0], [-38, -20], [-38, -7], [-38, 7], [-38, 20], [-22, -24], [-22, -8], [-22, 8], [-22, 24], [-6, -6], [-8, 9],
    ]
    const home = f.map(([x, z]) => ({ x, z, c: '#1f9d55', ry: Math.PI / 2 }))
    const away = f.map(([x, z]) => ({ x: -x * 0.92, z: -z * 1.05 + 2, c: '#2a7de1', ry: -Math.PI / 2 }))
    away[0].c = '#f2c94c'
    home[0].c = '#ff7a59'
    return [...home, ...away]
  }, [])

  useLayoutEffect(() => {
    const mesh = ref.current!
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    spots.forEach((s, i) => {
      // standing figure: lift the seated mesh and stretch it a bit
      o.position.set(s.x, 0.02, s.z)
      o.rotation.set(0, s.ry, 0)
      o.scale.setScalar(1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c.set(s.c))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [spots])

  return (
    <group>
      <instancedMesh ref={ref} args={[geometry, undefined, spots.length]} castShadow raycast={() => {}}>
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <mesh position={[0.6, 0.11, 0.4]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

export function Pitch() {
  const { config } = (venueModel as StadiumModel)
  const { length, width } = config.pitch
  const margin = 3
  const texture = useMemo(() => drawPitchTexture(length, width, margin), [length, width])
  const surround = useMemo(() => {
    const s = roundedRectShape(config.shape.hx, config.shape.hz, config.shape.r)
    const g = new THREE.ShapeGeometry(s, 24)
    g.rotateX(-Math.PI / 2)
    return g
  }, [config.shape])
  const trackEdge = useMemo(() => bowlAnnulus(config.shape.hx, config.shape.hz, config.shape.r, -2.2, 0), [config.shape])

  return (
    <group>
      <mesh geometry={surround} position={[0, 0.005, 0]} receiveShadow>
        <meshStandardMaterial color="#357f40" roughness={1} />
      </mesh>
      <mesh geometry={trackEdge} position={[0, 0.01, 0]} receiveShadow>
        <meshStandardMaterial color="#4b5160" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[length + margin * 2, width + margin * 2]} />
        <meshStandardMaterial map={texture} roughness={0.95} />
      </mesh>
      <Goal x={length / 2} />
      <Goal x={-length / 2} />
      <Players />
    </group>
  )
}
