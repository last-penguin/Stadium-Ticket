import { useMemo, useState, useSyncExternalStore } from 'react'
import { BarChart3, CalendarDays, LayoutGrid, RotateCcw } from 'lucide-react'
import { catalog, type EventRecord } from '../../services/catalog'
import { Shell } from '../Shell'
import { Dashboard } from './Dashboard'
import { EventsTab } from './EventsTab'
import { VenuesTab } from './VenuesTab'

type Tab = 'dashboard' | 'events' | 'venues'

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const snap = useSyncExternalStore(
    (cb) => catalog.subscribe(cb),
    () => JSON.stringify({ e: catalog.events(), v: catalog.venues().map((v) => v.updatedAt) }),
  )
  const events = useMemo(() => (JSON.parse(snap).e as EventRecord[]), [snap])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Live dashboard', icon: <BarChart3 size={14} /> },
    { id: 'events', label: 'Events & prices', icon: <CalendarDays size={14} /> },
    { id: 'venues', label: 'Venue layouts', icon: <LayoutGrid size={14} /> },
  ]

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Venue admin</div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass flex rounded-full p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                  tab === t.id ? 'bg-white text-ink' : 'text-white/70 hover:text-white'
                }`}
              >
                {t.icon} <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (confirm('Reset all venues and events to the demo data? Bookings and tickets are kept.')) catalog.reset()
            }}
            title="Reset demo venues and events"
            className="glass grid h-9 w-9 place-items-center rounded-full text-white/70 hover:text-white"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      {tab === 'dashboard' && <Dashboard events={events} />}
      {tab === 'events' && <EventsTab events={events} />}
      {tab === 'venues' && <VenuesTab />}
    </Shell>
  )
}
