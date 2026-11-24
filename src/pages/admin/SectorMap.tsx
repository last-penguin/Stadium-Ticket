import { useEffect, useMemo, useRef, useState } from 'react'
import type { VenueModel } from '../../venue/models'
import type { Sector } from '../../venue/types'

type Pt = [number, number]

function hull(points: Pt[]): Pt[] {
  if (points.length < 3) return points
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Pt[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

function inside(pt: Pt, poly: Pt[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/**
 * Top-down plan of a venue: one shape per sector (the outline of its seats),
 * coloured by the caller. Hover shows a tooltip. Works for any venue type.
 */
export function SectorMap({
  model,
  colorFor,
  tooltip,
  height = 340,
  showSeats = false,
}: {
  model: VenueModel
  colorFor: (s: Sector) => string
  tooltip: (s: Sector) => React.ReactNode
  height?: number
  showSeats?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<{ s: Sector; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Project venue XZ to canvas pixels (cinema: screen at the top).
  const geo = useMemo(() => {
    const flip = model.venue.kind === 'cinema' ? 1 : 1
    const shapes = model.venue.sectors.map((s) => ({
      s,
      pts: hull(s.seats.map((seat) => [seat.position[0], seat.position[2] * flip] as Pt)),
    }))
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const sh of shapes)
      for (const [x, z] of sh.pts) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minZ = Math.min(minZ, z)
        maxZ = Math.max(maxZ, z)
      }
    if (model.venue.focus.screen) minZ = Math.min(minZ, model.venue.focus.screen.center[2])
    return { shapes, minX, maxX, minZ, maxZ }
  }, [model])

  const pad = 14
  const scale = Math.min((width - pad * 2) / (geo.maxX - geo.minX), (height - pad * 2) / (geo.maxZ - geo.minZ))
  const ox = (width - (geo.maxX - geo.minX) * scale) / 2
  const oy = (height - (geo.maxZ - geo.minZ) * scale) / 2
  const toPx = (x: number, z: number): Pt => [ox + (x - geo.minX) * scale, oy + (z - geo.minZ) * scale]

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = width * dpr
    c.height = height * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (model.venue.kind === 'stadium') {
      // pitch
      const [x0, y0] = toPx(-52.5, -34)
      const [x1, y1] = toPx(52.5, 34)
      ctx.fillStyle = 'rgba(124,240,180,0.08)'
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
      ctx.beginPath()
      ctx.moveTo((x0 + x1) / 2, y0)
      ctx.lineTo((x0 + x1) / 2, y1)
      ctx.stroke()
    } else if (model.venue.focus.screen) {
      const sc = model.venue.focus.screen
      const [x0, y] = toPx(-sc.width / 2, sc.center[2])
      const [x1] = toPx(sc.width / 2, sc.center[2])
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '600 10px Inter Variable, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('SCREEN', (x0 + x1) / 2, y + 16)
    }
    for (const { s, pts } of geo.shapes) {
      if (pts.length < 3) continue
      ctx.beginPath()
      pts.forEach(([x, z], i) => {
        const [px, py] = toPx(x, z)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.closePath()
      ctx.fillStyle = colorFor(s)
      ctx.fill()
      // 2px surface gap between neighbouring sectors
      ctx.strokeStyle = '#0f131b'
      ctx.lineWidth = 2
      ctx.stroke()
      if (hover?.s.id === s.id) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
    if (showSeats) {
      ctx.fillStyle = 'rgba(11,14,20,0.55)'
      const r = Math.max(0.6, scale * 0.18)
      for (const s of model.venue.sectors)
        for (const seat of s.seats) {
          const [px, py] = toPx(seat.position[0], seat.position[2])
          ctx.fillRect(px - r / 2, py - r / 2, r, r)
        }
    }
  })

  const onMove = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const x = (mx - ox) / scale + geo.minX
    const z = (my - oy) / scale + geo.minZ
    // generous hit test: inside the hull, or nearest centre within ~14px
    let found = geo.shapes.find((sh) => sh.pts.length > 2 && inside([x, z], sh.pts))?.s ?? null
    if (!found) {
      let best = (14 / scale) ** 2
      for (const sh of geo.shapes) {
        const d = (sh.s.center[0] - x) ** 2 + (sh.s.center[2] - z) ** 2
        if (d < best) {
          best = d
          found = sh.s
        }
      }
    }
    setHover(found ? { s: found, x: mx, y: my } : null)
  }

  return (
    <div ref={wrap} className="relative w-full" style={{ height }}>
      <canvas
        ref={canvas}
        style={{ width, height }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block cursor-crosshair"
      />
      {hover && (
        <div
          className="glass pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-[12px]"
          style={{ left: Math.min(hover.x + 14, width - 200), top: Math.min(hover.y + 14, height - 70) }}
        >
          {tooltip(hover.s)}
        </div>
      )}
    </div>
  )
}
