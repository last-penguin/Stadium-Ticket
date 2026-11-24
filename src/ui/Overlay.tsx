import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { ArrowLeft, CalendarDays, MapPin, ScanLine, Ticket } from 'lucide-react'
import { startLive } from '../services/live'
import { Checkout } from './Checkout'
import { CompareTray, CompareView } from './Compare'
import { currentEvent, useStore, venueModel } from '../state/store'
import { formatEventDate } from '../services/catalog'
import { BottomPanel } from './Panels'
import { Tooltip } from './Tooltip'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#141922" />
        <ellipse cx="16" cy="17" rx="11" ry="8" fill="none" stroke="#7cf0b4" strokeWidth="2.5" />
        <rect x="11" y="13.5" width="10" height="7" rx="1.5" fill="#7cf0b4" />
      </svg>
      <span className="font-display text-[17px] font-semibold tracking-tight">SeatView</span>
    </div>
  )
}

function RingSwitcher({ id }: { id: string }) {
  const ringFilter = useStore((s) => s.ringFilter)
  const setRingFilter = useStore((s) => s.setRingFilter)
  const options: { label: string; value: number | null }[] = [
    { label: 'All', value: null },
    ...venueModel.venue.rings.map((r) => ({ label: r.shortName, value: r.index })),
  ]
  return (
    <div className="glass flex rounded-full p-1">
      {options.map((o) => {
        const active = ringFilter === o.value
        return (
          <button
            key={o.label}
            onClick={() => setRingFilter(o.value)}
            className={`relative rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors sm:px-4 ${
              active ? 'text-ink' : 'text-white/70 hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`ring-pill-${id}`}
                className="absolute inset-0 rounded-full bg-white"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function TopBar() {
  const mode = useStore((s) => s.mode)
  const back = useStore((s) => s.back)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-6">
      <div className="pointer-events-auto flex items-center gap-2">
        <AnimatePresence>
          {mode !== 'overview' && (
            <motion.button
              initial={{ opacity: 0, x: -8, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 44 }}
              exit={{ opacity: 0, x: -8, width: 0 }}
              onClick={back}
              aria-label="Back"
              className="glass grid h-11 place-items-center rounded-full"
            >
              <ArrowLeft size={18} />
            </motion.button>
          )}
        </AnimatePresence>
        <Link to="/" className="glass rounded-2xl px-4 py-2.5" title="All events">
          <Logo />
        </Link>
        <div className="glass hidden rounded-2xl px-4 py-2 md:block">
          <div className="text-[13px] font-semibold">{currentEvent.title}</div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <CalendarDays size={11} /> {formatEventDate(currentEvent)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {venueModel.venue.name}, {venueModel.venue.city}
            </span>
          </div>
        </div>
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="hidden sm:block">
          <AnimatePresence>
            {mode === 'overview' && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <RingSwitcher id="desktop" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge />
          <div className="rounded-full border border-amber-300/30 bg-ink/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200 backdrop-blur">
            Demo
          </div>
        </div>
        <div className="hidden gap-2 sm:flex">
          <NavPill to="/tickets" icon={<Ticket size={13} />} label="My tickets" />
          <NavPill to="/scan" icon={<ScanLine size={13} />} label="Gate scanner" />
        </div>
      </div>
      {/* phones: tier switcher on its own row */}
      <AnimatePresence>
        {mode === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pointer-events-auto fixed inset-x-0 top-[68px] flex justify-center sm:hidden"
          >
            <RingSwitcher id="mobile" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NavPill({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/85 hover:text-white">
      {icon} {label}
    </Link>
  )
}

function LiveBadge() {
  const n = useStore((s) => s.liveViewers)
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur"
      title="Open this page in another tab to see seats lock in real time"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
      Live · {n} {n === 1 ? 'fan' : 'fans'}
    </div>
  )
}

function Toast() {
  const toast = useStore((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useStore.setState({ toast: null }), 3400)
    return () => clearTimeout(t)
  }, [toast])
  const tone =
    toast?.tone === 'error' ? 'bg-red-500 text-white' : toast?.tone === 'success' ? 'bg-mint text-ink' : 'bg-white text-ink'
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4 sm:top-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={`max-w-md rounded-2xl px-4 py-3 text-center text-[13px] font-medium shadow-xl ${tone}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Loader() {
  const ready = useStore((s) => s.ready)
  const [minTime, setMinTime] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 1100)
    return () => clearTimeout(t)
  }, [])
  const done = ready && minTime
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ink"
        >
          <div className="flex flex-col items-center gap-4">
            <Logo />
            <div className="h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-mint"
                initial={{ width: '0%' }}
                animate={{ width: ready ? '100%' : '80%' }}
                transition={{ duration: ready ? 0.3 : 2.5, ease: 'easeOut' }}
              />
            </div>
            <div className="text-[12px] text-muted">Loading the venue…</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Overlay() {
  useEffect(() => startLive(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useStore.getState().back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <>
      <TopBar />
      <BottomPanel />
      <Tooltip />
      <CompareTray />
      <CompareView />
      <Checkout />
      <Toast />
      <Loader />
    </>
  )
}
