import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Activity, Armchair, Banknote, Clock, ExternalLink, Ticket } from 'lucide-react'
import { catalog, formatEventDate, type EventRecord } from '../../services/catalog'
import { backend, onSeatsChanged } from '../../services/live'
import { formatPrice } from '../../venue/format'
import { statsFor } from '../eventStats'
import { SectorMap } from './SectorMap'

// Sequential ramp (one hue) for occupancy on the dark surface: low = dim, high = bright.
const RAMP = ['#16302a', '#1d4a3c', '#24664f', '#2f8a66', '#4fb886', '#7cf0b4']
const rampColor = (t: number) => RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)))]

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  )
}

export function Dashboard({ events }: { events: EventRecord[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [tick, setTick] = useState(0)
  const event = events.find((e) => e.id === eventId) ?? events[0]

  // live refresh: other tabs booking / holding seats, plus expiring holds
  useEffect(() => {
    const off = onSeatsChanged(() => setTick((t) => t + 1))
    const t = setInterval(() => setTick((n) => n + 1), 3000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [])

  const stats = useMemo(() => (event ? statsFor(event) : null), [event, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!event || !stats) return <div className="glass rounded-3xl p-6 text-muted">No events yet. Create one in the Events tab.</div>

  const occ = stats.sold / Math.max(1, stats.capacity)
  const tickets = backend.tickets().filter((t) => t.eventId === event.id)
  const venue = catalog.venue(event.venueId)
  const maxTierRevenue = Math.max(1, ...stats.byTier.map((t) => t.revenue))
  const sectorStat = new Map(stats.sectors.map((s) => [s.id, s]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => setEventId(e.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
              e.id === event.id ? 'bg-white text-ink' : 'glass text-white/75 hover:text-white'
            }`}
          >
            {e.title}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          Live
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-display text-2xl font-semibold">{event.title}</div>
          <div className="text-[13px] text-muted">
            {formatEventDate(event)} · {venue?.layout.name}
          </div>
        </div>
        <Link to={`/event/${event.id}`} className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] hover:bg-white/10">
          <ExternalLink size={14} /> Open booking page
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={<Banknote size={13} />} label="Revenue" value={formatPrice(stats.revenue)} sub="incl. demo pre-sales" />
        <Kpi
          icon={<Armchair size={13} />}
          label="Occupancy"
          value={`${(occ * 100).toFixed(1)}%`}
          sub={`${stats.sold.toLocaleString()} of ${stats.capacity.toLocaleString()} seats`}
        />
        <Kpi icon={<Clock size={13} />} label="On hold now" value={stats.held.toLocaleString()} sub="in someone's checkout" />
        <Kpi icon={<Ticket size={13} />} label="Sold on SeatView" value={stats.online.toLocaleString()} sub={formatPrice(stats.onlineRevenue)} />
        <Kpi
          icon={<Activity size={13} />}
          label="Seats left"
          value={(stats.capacity - stats.sold - stats.held).toLocaleString()}
          sub={`from ${formatPrice(stats.minPrice)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[15px] font-semibold">Live occupancy by sector</div>
              <div className="text-[12px] text-muted">Hover a sector for details</div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              0%
              <div className="flex h-2 w-28 overflow-hidden rounded-full">
                {RAMP.map((c) => (
                  <div key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              100%
            </div>
          </div>
          <div className="mt-3">
            <SectorMap
              model={stats.model}
              colorFor={(s) => {
                const st = sectorStat.get(s.id)!
                return rampColor(st.sold / Math.max(1, st.total))
              }}
              tooltip={(s) => {
                const st = sectorStat.get(s.id)!
                return (
                  <>
                    <div className="font-semibold">{s.label}</div>
                    <div className="tabular text-muted">
                      {st.sold} / {st.total} sold · {Math.round((st.sold / st.total) * 100)}%
                    </div>
                    {st.held > 0 && <div className="text-amber-300">{st.held} on hold</div>}
                  </>
                )
              }}
            />
          </div>
        </div>

        <div className="glass rounded-3xl p-5">
          <div className="font-display text-[15px] font-semibold">Revenue by price tier</div>
          <div className="text-[12px] text-muted">Seats sold × tier price</div>
          <div className="mt-4 space-y-4">
            {stats.byTier.map((t) => (
              <div key={t.id} title={`${t.name}: ${formatPrice(t.revenue)} from ${t.sold} seats`}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: t.color }} />
                    {t.name} <span className="text-muted">· {formatPrice(t.price)}</span>
                  </span>
                  <span className="font-medium tabular">{formatPrice(t.revenue)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${(t.revenue / maxTierRevenue) * 100}%`, background: t.color }} />
                </div>
                <div className="mt-1 text-[11px] text-muted tabular">
                  {t.sold.toLocaleString()} / {t.capacity.toLocaleString()} seats · {Math.round((t.sold / Math.max(1, t.capacity)) * 100)}% sold
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="font-display text-[15px] font-semibold">Recent SeatView bookings</div>
          <span className="text-[12px] text-muted">{tickets.length} total</span>
        </div>
        {tickets.length === 0 ? (
          <div className="px-5 pb-5 text-[13px] text-muted">No online bookings for this event yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr className="border-t border-line">
                  <th className="px-5 py-2.5 font-medium">Time</th>
                  <th className="px-5 py-2.5 font-medium">Ticket</th>
                  <th className="px-5 py-2.5 font-medium">Seat</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 text-right font-medium">Paid</th>
                  <th className="px-5 py-2.5 font-medium">Gate</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 12).map((t) => {
                  const used = backend.authority.redemption(t.id)
                  return (
                    <tr key={t.id} className="border-t border-line">
                      <td className="px-5 py-2.5 tabular text-muted">
                        {new Date(t.issuedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-[12px]">{t.id}</td>
                      <td className="px-5 py-2.5">
                        {t.sectorLabel} · Row {t.row} · Seat {t.seat}
                      </td>
                      <td className="px-5 py-2.5">{t.holderName}</td>
                      <td className="px-5 py-2.5 text-right tabular">{formatPrice(t.price)}</td>
                      <td className="px-5 py-2.5">
                        {used ? (
                          <span className="text-amber-300">Scanned · {used.gate}</span>
                        ) : (
                          <span className="text-mint">Not scanned</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
