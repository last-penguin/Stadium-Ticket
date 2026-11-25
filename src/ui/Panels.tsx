import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Accessibility, Check, Columns3, Eye, Hand, Loader2, MousePointerClick, Move3d, Ticket } from 'lucide-react'
import { captureSettledView } from '../scene/Capture'
import { announce, backend, holderId } from '../services/live'
import { getSeat, getSector, tierOf, useStore, venueModel } from '../state/store'
import { formatPrice, seatName } from '../venue/format'
import { formatMetric, seatBadges, sectorAvailability, seatMetrics } from '../venue/metrics'
import { SeatDiagram } from './SeatDiagram'


function Stepper({ step }: { step: number }) {
  const STEPS = venueModel.venue.terms.steps
  const HINTS = [`Choose a ${venueModel.venue.terms.area}`, 'Pick your seat', 'Check your view', 'Checkout']
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-col gap-1">
            <div
              className="h-[3px] w-10 rounded-full transition-colors duration-500 sm:w-14"
              style={{ background: i <= step ? '#7cf0b4' : 'rgb(255 255 255 / 0.12)' }}
            />
            <span className={`text-[10px] uppercase tracking-[0.14em] ${i === step ? 'text-white' : 'text-muted/70'}`}>
              {s}
            </span>
          </div>
        ))}
      </div>
      <div className="ml-auto hidden text-right text-[12px] text-muted sm:block">
        Step {step + 1} of 4 · <span className="text-white/90">{HINTS[step]}</span>
      </div>
    </div>
  )
}

const panelMotion = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
  transition: { type: 'spring', stiffness: 260, damping: 28 },
} as const

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {venueModel.venue.tiers.map((t) => (
        <div key={t.id} className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: t.color }} />
          <span className="text-white/85">{t.name}</span>
          <span className="tabular">{formatPrice(t.price)}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[#9b7bff]" /> Accessible
      </div>
    </div>
  )
}

function OverviewPanel() {
  const free = useMemo(
    () => venueModel.venue.sectors.reduce((n, s) => n + sectorAvailability(s).free, 0),
    [],
  )
  return (
    <motion.div {...panelMotion} className="glass w-full rounded-3xl p-5 sm:max-w-[560px]">
      <Stepper step={0} />
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-xl font-semibold leading-tight">{venueModel.venue.terms.pickArea}</div>
          <p className="mt-1 text-[13px] text-muted sm:hidden">Tap a block to fly in and see the view.</p>
          <p className="mt-1 hidden max-w-[340px] text-[13px] leading-relaxed text-muted sm:block">
            Hover the seating to compare prices, then click a block to fly in. Every seat shows you its real view before
            you pay.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-semibold tabular">{free.toLocaleString()}</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">seats left</div>
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <Legend />
      </div>
      <div className="mt-3 hidden items-center gap-4 text-[11px] text-muted/80 sm:flex">
        <span className="flex items-center gap-1.5"><MousePointerClick size={13} /> Click a block</span>
        <span className="flex items-center gap-1.5"><Move3d size={13} /> Drag to orbit · scroll to zoom</span>
      </div>
    </motion.div>
  )
}

function SectorPanel() {
  const sector = getSector(useStore((s) => s.selectedSectorId))
  if (!sector) return null
  const tier = tierOf(sector)
  const ring = venueModel.venue.rings[sector.ringIndex]
  const { free, total, accessible } = sectorAvailability(sector)
  return (
    <motion.div {...panelMotion} className="glass w-full rounded-3xl p-5 sm:max-w-[560px]">
      <Stepper step={1} />
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: tier.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tier.color }} />
            {tier.name} · {sector.standName}
          </div>
          <div className="mt-1 font-display text-xl font-semibold">{sector.label}</div>
          <div className="text-[13px] text-muted">
            {ring.name} · {ring.rows} rows
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-semibold tabular">{formatPrice(tier.price)}</div>
          <div className="text-[12px] text-muted tabular">
            {free} of {total} free
          </div>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${(1 - free / total) * 100}%`, background: tier.color }} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: tier.color }} /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#5d636e]" /> Taken
        </span>
        {accessible > 0 && (
          <span className="flex items-center gap-1.5">
            <Accessibility size={13} className="text-[#b9a4ff]" /> {accessible} wheelchair spaces
          </span>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-muted/80 sm:flex">
          <Eye size={13} /> Click any free seat to see its view
        </span>
      </div>
    </motion.div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2.5">
      <div className="font-display text-lg font-semibold tabular">{value}</div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  )
}

function SeatCard() {
  const seat = getSeat(useStore((s) => s.selectedSeatId))
  const back = useStore((s) => s.back)
  const compare = useStore((s) => s.compare)
  const [busy, setBusy] = useState(false)
  if (!seat) return null
  const inCompare = compare.includes(seat.id)

  const toggleCompare = async () => {
    const st = useStore.getState()
    if (inCompare) return st.removeFromCompare(seat.id)
    const shot = await captureSettledView()
    st.addToCompare(seat.id, shot)
    st.showToast(
      st.compare.length >= 2 ? 'Added. Open the comparison from the tray.' : 'Added to comparison. Pick another seat to compare.',
      'success',
    )
  }

  const book = async () => {
    setBusy(true)
    const st = useStore.getState()
    const shot = await captureSettledView()
    st.setSnapshot(seat.id, shot)
    const res = await backend.hold(seat.id, holderId)
    announce()
    setBusy(false)
    if (!res.ok) {
      st.showToast(
        res.reason === 'held'
          ? 'Someone else is checking out this seat right now. Try another one.'
          : 'Sorry, this seat was just sold.',
        'error',
      )
      st.back()
      return
    }
    st.setCheckoutOpen(true)
  }
  const sector = getSector(seat.sectorId)!
  const tier = tierOf(sector)
  const ring = venueModel.venue.rings[sector.ringIndex]
  const m = seatMetrics(seat, venueModel.venue)

  return (
    <motion.div {...panelMotion} className="glass relative w-full rounded-3xl p-5 sm:max-w-[460px]">
      <Stepper step={2} />
      <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: tier.color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tier.color }} />
        {tier.name} · {sector.standName}
        {seat.accessible && (
          <span className="ml-1 flex items-center gap-1 text-[#b9a4ff]">
            <Accessibility size={12} /> Wheelchair
          </span>
        )}
      </div>
      <div className="mt-1 font-display text-[22px] font-semibold leading-tight tabular">
        {sector.label}, {seatName(seat)}
      </div>
      <div className="text-[13px] text-muted">
        {ring.name} · {formatPrice(tier.price)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {m.map((x) => (
          <Stat key={x.id} value={formatMetric(x)} label={x.label} />
        ))}
      </div>
      {seat.aircraft && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {seatBadges(seat).map((b) => (
              <span key={b} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] text-white/85">
                {b}
              </span>
            ))}
          </div>
          <div className="hidden sm:block">
            <SeatDiagram seat={seat} />
          </div>
        </div>
      )}
      <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
        <button
          onClick={back}
          className="rounded-2xl border border-white/15 px-3 py-3 text-[14px] font-medium transition hover:bg-white/10"
        >
          Change seat
        </button>
        <button
          onClick={book}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-[14px] font-semibold text-ink transition hover:bg-mint disabled:opacity-70"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />} Book · {formatPrice(tier.price)}
        </button>
        <button
          onClick={toggleCompare}
          title={inCompare ? 'Remove from comparison' : 'Add to comparison'}
          aria-label={inCompare ? 'Remove from comparison' : 'Add to comparison'}
          className={`grid w-12 place-items-center rounded-2xl border transition ${
            inCompare ? 'border-mint/50 bg-mint/15 text-mint' : 'border-white/15 hover:bg-white/10'
          }`}
        >
          {inCompare ? <Check size={17} /> : <Columns3 size={17} />}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted/80">
        <Hand size={12} /> Drag to look around · scroll to zoom · <Columns3 size={12} /> compare up to 3 seats
      </div>
    </motion.div>
  )
}

export function BottomPanel() {
  const mode = useStore((s) => s.mode)
  const hidden = useStore((s) => s.checkoutOpen || s.compareOpen)
  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 transition-opacity ${hidden ? 'opacity-0' : ''} flex justify-center p-3 sm:justify-start sm:p-6`}>
      <div className={`${hidden ? '' : 'pointer-events-auto'} w-full sm:w-auto`}>
        <AnimatePresence mode="wait">
          {mode === 'overview' && <OverviewPanel key="o" />}
          {mode === 'sector' && <SectorPanel key="s" />}
          {mode === 'seat' && <SeatCard key="c" />}
        </AnimatePresence>
      </div>
    </div>
  )
}
