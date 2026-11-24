import { AnimatePresence, motion } from 'motion/react'
import { Accessibility } from 'lucide-react'
import { getSeat, getSector, tierOf, useStore, venueModel } from '../state/store'
import { formatPrice } from '../venue/format'
import { sectorAvailability } from '../venue/metrics'

/** Floating label that follows the cursor over stands and seats. */
export function Tooltip() {
  const mode = useStore((s) => s.mode)
  const pointer = useStore((s) => s.pointer)
  const hoveredSector = getSector(useStore((s) => s.hoveredSectorId))
  const hoveredSeat = getSeat(useStore((s) => s.hoveredSeatId))

  let content: React.ReactNode = null
  let key = ''

  if (mode === 'overview' && hoveredSector) {
    const tier = tierOf(hoveredSector)
    const { free } = sectorAvailability(hoveredSector)
    const ring = venueModel.venue.rings[hoveredSector.ringIndex]
    key = hoveredSector.id
    content = (
      <div className="flex items-center gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {hoveredSector.standName} · {ring.shortName}
          </div>
          <div className="font-display text-[15px] font-semibold">{hoveredSector.label}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            <span className="text-white/90 tabular">{free}</span> seats left
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: tier.color }}>
            {tier.name}
          </div>
          <div className="font-display text-[15px] font-semibold tabular">{formatPrice(tier.price)}</div>
        </div>
      </div>
    )
  } else if (mode === 'sector' && hoveredSeat) {
    const sector = getSector(hoveredSeat.sectorId)!
    const tier = tierOf(sector)
    const mine = useStore.getState().myHold?.seatId === hoveredSeat.id
    const held = hoveredSeat.status === 'held' && !mine
    const sold = hoveredSeat.status !== 'available' && !mine
    key = hoveredSeat.id
    content = (
      <div className="flex items-center gap-4">
        <div>
          <div className="font-display text-[14px] font-semibold tabular">
            Row {hoveredSeat.rowLabel} · Seat {hoveredSeat.number}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
            {hoveredSeat.accessible && <Accessibility size={12} className="text-[#b9a4ff]" />}
            {mine
              ? 'Held for you'
              : held
                ? 'On hold · someone is checking out'
                : sold
                  ? 'Already taken'
                  : hoveredSeat.accessible
                    ? 'Wheelchair space'
                    : 'Click to see your view'}
          </div>
        </div>
        <div
          className="rounded-lg px-2 py-1 font-display text-[13px] font-semibold tabular"
          style={{
            background: held ? '#d9942b' : sold ? 'rgb(255 255 255 / 0.08)' : mine ? '#7cf0b4' : tier.color,
            color: sold && !held ? '#9aa3b2' : '#0b0e14',
          }}
        >
          {held ? 'On hold' : sold ? 'Sold' : formatPrice(tier.price)}
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {content && (
        <motion.div
          key={mode}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          className="glass pointer-events-none fixed z-30 rounded-2xl px-4 py-3"
          style={{
            left: Math.min(pointer.x + 16, window.innerWidth - 300),
            top: Math.min(pointer.y + 16, window.innerHeight - 110),
          }}
          data-key={key}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
