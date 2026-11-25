import { useMemo, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, CalendarDays, Clapperboard, Columns3, Eye, MapPin, Plane, QrCode, Trophy, Zap } from 'lucide-react'
import { catalog, formatEventDate, type EventRecord } from '../services/catalog'
import { formatPrice } from '../venue/format'
import { statsFor } from './eventStats'
import { Shell } from './Shell'

const CATEGORY_STYLE: Record<string, { from: string; to: string; icon: React.ReactNode }> = {
  Football: { from: '#1f7a47', to: '#0f2d4a', icon: <Trophy size={18} /> },
  Cricket: { from: '#2f7d32', to: '#18324a', icon: <Trophy size={18} /> },
  Movie: { from: '#3a1450', to: '#141a4a', icon: <Clapperboard size={18} /> },
  Concert: { from: '#7a1f4a', to: '#1b1f4a', icon: <Zap size={18} /> },
  Theatre: { from: '#6b3a12', to: '#2a1430', icon: <Clapperboard size={18} /> },
  Flight: { from: '#1f5fae', to: '#0f2244', icon: <Plane size={18} /> },
}

function useEvents() {
  const snap = useSyncExternalStore(
    (cb) => catalog.subscribe(cb),
    () => JSON.stringify(catalog.events()),
  )
  return useMemo(() => (JSON.parse(snap) as EventRecord[]).filter((e) => e.status === 'on-sale'), [snap])
}

function EventCard({ event, i }: { event: EventRecord; i: number }) {
  const stats = useMemo(() => statsFor(event), [event])
  const venue = catalog.venue(event.venueId)
  const style = CATEGORY_STYLE[event.category] ?? CATEGORY_STYLE.Football
  if (!stats || !venue) return null
  const left = stats.capacity - stats.sold - stats.held
  const pct = stats.sold / Math.max(1, stats.capacity)
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <Link
        to={`/event/${event.id}`}
        className="glass group block overflow-hidden rounded-3xl transition hover:-translate-y-0.5 hover:border-white/20"
      >
        <div className="relative h-36 overflow-hidden" style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}>
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_80%_20%,white,transparent_40%)]" />
          {venue.kind === 'aircraft' ? (
            <svg viewBox="0 0 200 120" className="absolute -bottom-3 right-0 h-40 opacity-85">
              <rect x="40" y="52" width="140" height="18" rx="9" fill="rgba(255,255,255,.6)" />
              <path d="M 120 58 L 92 10 L 80 10 L 96 58 Z M 120 64 L 92 112 L 80 112 L 96 64 Z" fill="rgba(255,255,255,.35)" />
              <path d="M 52 56 L 40 36 L 33 36 L 40 58 Z" fill="rgba(124,240,180,.6)" />
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <rect key={i} x={70 + i * 11} y="56" width="5" height="10" rx="1.5" fill="rgba(31,95,174,.8)" />
              ))}
            </svg>
          ) : venue.kind === 'stadium' ? (
            <svg viewBox="0 0 200 120" className="absolute -bottom-6 right-0 h-40 opacity-80">
              <ellipse cx="110" cy="70" rx="80" ry="44" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="10" />
              <ellipse cx="110" cy="70" rx="58" ry="30" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="8" />
              <rect x="80" y="56" width="60" height="28" rx="4" fill="rgba(124,240,180,.55)" />
            </svg>
          ) : (
            <svg viewBox="0 0 200 120" className="absolute -bottom-2 right-2 h-36 opacity-80">
              <rect x="40" y="14" width="140" height="46" rx="4" fill="rgba(255,255,255,.55)" />
              {[0, 1, 2, 3].map((r) => (
                <path key={r} d={`M ${30 - r * 4} ${76 + r * 11} Q 110 ${68 + r * 11} ${190 + r * 4} ${76 + r * 11}`} stroke="rgba(255,255,255,.3)" strokeWidth="6" fill="none" strokeDasharray="7 3" />
              ))}
            </svg>
          )}
          <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            {style.icon} {event.category}
          </div>
        </div>
        <div className="p-5">
          <div className="font-display text-xl font-semibold leading-tight">{event.title}</div>
          <div className="mt-0.5 text-[13px] text-muted">{event.subtitle}</div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/75">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} /> {formatEventDate(event)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {venue.layout.name}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-mint" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span className="tabular">{left.toLocaleString()} seats left</span>
            <span className="tabular">{Math.round(pct * 100)}% sold</span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted">from</div>
              <div className="font-display text-lg font-semibold tabular">{formatPrice(stats.minPrice)}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition group-hover:bg-mint">
              Choose seats <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function HomePage() {
  const events = useEvents()
  return (
    <Shell>
      <section className="py-6 sm:py-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Stadiums · Cinemas · Flights</div>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          See your seat <span className="text-mint">before</span> you buy it.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Explore the venue in 3D (a stadium, a cinema or even a plane), sit in any seat to check the real view,
          compare a few seats side by side, and book with a ticket that can't be copied.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-[12px] text-white/80">
          {[
            [<Eye size={14} key="e" />, 'View from every seat'],
            [<Columns3 size={14} key="c" />, 'Compare up to 3 seats'],
            [<Zap size={14} key="z" />, 'Live seat locking'],
            [<QrCode size={14} key="q" />, 'Signed QR tickets'],
          ].map(([icon, label]) => (
            <span key={label as string} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
              {icon} {label}
            </span>
          ))}
        </div>
      </section>

      <div className="mb-4 mt-4 flex items-end justify-between">
        <h2 className="font-display text-2xl font-semibold">On sale now</h2>
        <span className="text-[12px] text-muted">{events.length} events</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e, i) => (
          <EventCard key={e.id} event={e} i={i} />
        ))}
      </div>
      <p className="mt-10 text-center text-[11px] text-muted">
        Demo project · fictional teams, venues and prices · payments run in test mode
      </p>
    </Shell>
  )
}
