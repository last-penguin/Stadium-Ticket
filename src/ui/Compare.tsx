import { AnimatePresence, motion } from 'motion/react'
import { Columns3, Eye, Sparkles, Trophy, X } from 'lucide-react'
import { getSeat, getSector, tierOf, useStore, venueModel } from '../state/store'
import { formatPrice, seatName } from '../venue/format'
import { formatMetric, seatMetrics, viewScore } from '../venue/metrics'
import type { Seat } from '../venue/types'

function describe(seat: Seat) {
  const sector = getSector(seat.sectorId)!
  const tier = tierOf(sector)
  const ring = venueModel.venue.rings[sector.ringIndex]
  const m = seatMetrics(seat, venueModel.venue)
  const v = viewScore(seat, venueModel.venue)
  return { seat, sector, tier, ring, m, v }
}

/** Small floating tray listing the seats picked for comparison. */
export function CompareTray() {
  const compare = useStore((s) => s.compare)
  const snapshots = useStore((s) => s.snapshots)
  const mode = useStore((s) => s.mode)
  const open = useStore((s) => s.compareOpen)
  const checkoutOpen = useStore((s) => s.checkoutOpen)
  const visible = compare.length > 0 && !open && !checkoutOpen && mode !== 'overview'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="glass pointer-events-auto fixed right-3 top-[68px] z-20 flex items-center gap-2 rounded-2xl p-2 sm:bottom-6 sm:right-6 sm:top-auto"
        >
          <div className="flex -space-x-2">
            {compare.map((id) => (
              <div key={id} className="h-10 w-14 overflow-hidden rounded-lg border-2 border-ink bg-white/10">
                {snapshots[id] && <img src={snapshots[id]} alt="" className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
          <button
            onClick={() => useStore.getState().setCompareOpen(true)}
            disabled={compare.length < 2}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-ink transition enabled:hover:bg-mint disabled:opacity-50"
          >
            <Columns3 size={15} />
            {compare.length < 2 ? 'Add 1 more' : `Compare ${compare.length}`}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Metric({ label, value, best }: { label: string; value: string; best: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-line py-2.5 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={`flex items-center gap-1.5 font-medium tabular ${best ? 'text-mint' : ''}`}>
        {best && <Trophy size={12} />}
        {value}
      </span>
    </div>
  )
}

/** Full-screen side-by-side comparison of 2-3 seats. */
export function CompareView() {
  const open = useStore((s) => s.compareOpen)
  const compare = useStore((s) => s.compare)
  const snapshots = useStore((s) => s.snapshots)
  const items = compare.map((id) => getSeat(id)).filter((s): s is Seat => !!s).map(describe)

  const minBy = (f: (i: (typeof items)[number]) => number) => Math.min(...items.map(f))
  const maxBy = (f: (i: (typeof items)[number]) => number) => Math.max(...items.map(f))
  const bestPrice = minBy((i) => i.tier.price)
  const bestScore = maxBy((i) => i.v.score)
  // best value per metric (only for metrics where lower/higher is clearly better)
  const bestMetric = (k: number) => {
    const better = items[0]?.m[k]?.better
    if (!better || better === 'none') return null
    return better === 'low' ? minBy((i) => i.m[k].value) : maxBy((i) => i.m[k].value)
  }
  // best value = most view score per rupee
  const value = items.length
    ? items.reduce((a, b) => (b.v.score / b.tier.price > a.v.score / a.tier.price ? b : a))
    : null

  const close = () => useStore.getState().setCompareOpen(false)

  return (
    <AnimatePresence>
      {open && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 overflow-y-auto bg-ink/70 backdrop-blur-md"
          onClick={close}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto my-6 w-[min(1100px,calc(100%-24px))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Seat comparison</div>
                <div className="font-display text-2xl font-semibold">Which seat is right for you?</div>
              </div>
              <button onClick={close} className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {value && items.length > 1 && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-mint/25 bg-mint/10 px-4 py-3 text-[13px]">
                <Sparkles size={15} className="text-mint" />
                <span>
                  Best value: <b>{value.sector.label}, {seatName(value.seat)}</b>, with a view
                  score of {value.v.score} for {formatPrice(value.tier.price)}.
                </span>
              </div>
            )}

            <div className={`grid gap-3 ${items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {items.map((i) => (
                <div key={i.seat.id} className="glass overflow-hidden rounded-3xl">
                  <div className="relative aspect-[16/10] bg-white/5">
                    {snapshots[i.seat.id] ? (
                      <img src={snapshots[i.seat.id]} alt={`View from ${i.sector.label}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-[12px] text-muted">No preview</div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                      <span style={{ color: i.tier.color }}>●</span> {i.tier.name}
                    </div>
                    <button
                      onClick={() => useStore.getState().removeFromCompare(i.seat.id)}
                      className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-ink/75 backdrop-blur hover:bg-ink"
                      aria-label="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                      {i.sector.standName} · {i.ring.shortName}
                    </div>
                    <div className="font-display text-lg font-semibold tabular">
                      {i.sector.label}, {seatName(i.seat)}
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <div className="font-display text-3xl font-semibold tabular">{i.v.score}</div>
                        <div className="text-[11px] text-muted">view score · {i.v.label}</div>
                      </div>
                      <div className={`font-display text-xl font-semibold tabular ${i.tier.price === bestPrice && items.length > 1 ? 'text-mint' : ''}`}>
                        {formatPrice(i.tier.price)}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-mint" style={{ width: `${i.v.score}%` }} />
                    </div>
                    <div className="mt-3">
                      <Metric label="View score" value={`${i.v.score}/100`} best={items.length > 1 && i.v.score === bestScore} />
                      {i.m.map((x, k) => (
                        <Metric
                          key={x.id}
                          label={x.label[0].toUpperCase() + x.label.slice(1)}
                          value={formatMetric(x)}
                          best={items.length > 1 && bestMetric(k) === x.value}
                        />
                      ))}
                      <Metric label="Price" value={formatPrice(i.tier.price)} best={items.length > 1 && i.tier.price === bestPrice} />
                    </div>
                    <button
                      onClick={() => useStore.getState().openSeat(i.seat.id)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:bg-mint"
                    >
                      <Eye size={15} /> Go to this seat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
