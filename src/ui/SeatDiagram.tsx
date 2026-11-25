import { getSector } from '../state/store'
import type { Seat } from '../venue/types'

type Side = 'window' | 'aisle' | 'neighbour' | 'divider'

/** What is directly to the left / right of an aircraft seat. */
function sides(seat: Seat): { left: Side; right: Side } {
  const a = seat.aircraft!
  const row = getSector(seat.sectorId)?.seats.filter((s) => s.row === seat.row) ?? []
  const gap = (a.widthIn + a.armrestIn) * 0.0254 * 1.25
  const z = seat.position[2]
  const has = (dir: number) => row.some((s) => s.id !== seat.id && Math.sign(s.position[2] - z) === dir && Math.abs(s.position[2] - z) < gap)
  // facing +x, the passenger's right hand is +z
  const pick = (dir: number): Side => {
    if (has(dir)) return a.suite ? 'divider' : 'neighbour'
    const outer = row.every((s) => (dir > 0 ? s.position[2] <= z : s.position[2] >= z))
    return outer && a.place === 'window' ? 'window' : 'aisle'
  }
  return { left: pick(-1), right: pick(1) }
}

const LABEL: Record<Side, string> = { window: 'Window', aisle: 'Aisle', neighbour: 'Neighbour', divider: 'Divider' }

/**
 * Top-down sketch of your seat: the seat in front with the legroom between,
 * your seat width, and what is on either side of you.
 */
export function SeatDiagram({ seat }: { seat: Seat }) {
  const a = seat.aircraft
  if (!a) return null
  const { left, right } = sides(seat)
  // scale: legroom 28-80 in -> 26-74 px
  const leg = Math.max(26, Math.min(74, (a.pitchIn - 14) * 1.1))
  const W = 300
  const seatW = 54
  const cx = W / 2
  const frontY = 8
  const seatY = frontY + 26 + leg
  const sideBox = (side: Side, x: number) => {
    if (side === 'window')
      return (
        <g>
          <rect x={x - 6} y={seatY - 6} width={12} height={52} rx={6} fill="#1d2a3d" stroke="#7cb8ff" strokeOpacity={0.6} />
          <rect x={x - 3} y={seatY + 8} width={6} height={16} rx={3} fill="#9fd0ff" opacity={0.8} />
        </g>
      )
    if (side === 'aisle')
      return (
        <rect x={x - 22} y={seatY - 4} width={44} height={50} rx={6} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
      )
    if (side === 'divider') return <rect x={x - 3} y={seatY - 10} width={6} height={60} rx={3} fill="#cfc2a8" opacity={0.7} />
    return <rect x={x - 22} y={seatY} width={44} height={42} rx={8} fill="rgba(255,255,255,0.14)" />
  }
  const lx = cx - seatW / 2 - (left === 'window' ? 12 : left === 'divider' ? 8 : 30)
  const rx = cx + seatW / 2 + (right === 'window' ? 12 : right === 'divider' ? 8 : 30)

  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 pb-2 pt-1">
      <svg viewBox={`0 0 ${W} ${seatY + 62}`} className="w-full" role="img" aria-label={`Seat diagram: ${a.pitchIn} inch legroom, ${a.widthIn} inch wide`}>
        {/* seat (or wall) in front */}
        {a.bulkhead ? (
          <rect x={cx - 70} y={frontY + 6} width={140} height={10} rx={3} fill="rgba(255,255,255,0.22)" />
        ) : (
          <rect x={cx - seatW / 2} y={frontY} width={seatW} height={26} rx={7} fill="rgba(255,255,255,0.14)" />
        )}
        <text x={cx + (a.bulkhead ? 78 : seatW / 2 + 8)} y={frontY + 15} fill="#9aa3b2" fontSize="10">
          {a.bulkhead ? 'wall in front' : 'seat in front'}
        </text>
        {/* legroom dimension */}
        <line x1={cx} y1={frontY + 28} x2={cx} y2={seatY - 2} stroke="#7cf0b4" strokeWidth={2} />
        <path d={`M ${cx - 4} ${frontY + 33} L ${cx} ${frontY + 27} L ${cx + 4} ${frontY + 33}`} stroke="#7cf0b4" strokeWidth={2} fill="none" />
        <path d={`M ${cx - 4} ${seatY - 7} L ${cx} ${seatY - 1} L ${cx + 4} ${seatY - 7}`} stroke="#7cf0b4" strokeWidth={2} fill="none" />
        <text x={cx - 8} y={(frontY + 28 + seatY) / 2 + 4} fill="#7cf0b4" fontSize="12" fontWeight="600" textAnchor="end">
          {a.pitchIn} in legroom
        </text>
        {/* your seat */}
        <rect x={cx - seatW / 2} y={seatY} width={seatW} height={42} rx={9} fill="#7cf0b4" />
        <text x={cx} y={seatY + 26} fill="#0b0e14" fontSize="12" fontWeight="700" textAnchor="middle">
          {seat.label}
        </text>
        {/* width dimension */}
        <line x1={cx - seatW / 2} y1={seatY + 52} x2={cx + seatW / 2} y2={seatY + 52} stroke="#ffffff" strokeOpacity={0.6} />
        <text x={cx} y={seatY + 62} fill="#c8ced8" fontSize="10" textAnchor="middle">
          {a.widthIn} in wide
        </text>
        {/* sides */}
        {sideBox(left, lx)}
        {sideBox(right, rx)}
        <text x={cx - 68} y={seatY + 62} fill="#9aa3b2" fontSize="10" textAnchor="middle">
          {LABEL[left]}
        </text>
        <text x={cx + 68} y={seatY + 62} fill="#9aa3b2" fontSize="10" textAnchor="middle">
          {LABEL[right]}
        </text>
      </svg>
    </div>
  )
}
