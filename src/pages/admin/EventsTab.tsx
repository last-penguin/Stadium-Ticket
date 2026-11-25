import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, ExternalLink, Pencil, Save, Trash2, X } from 'lucide-react'
import { catalog, formatEventDate, type EventCategory, type EventRecord } from '../../services/catalog'
import { formatPrice } from '../../venue/format'
import { Field, inputCls, NumberInput } from './ui'

const CATEGORIES: EventCategory[] = ['Football', 'Cricket', 'Movie', 'Concert', 'Theatre', 'Flight']

function blankEvent(): EventRecord {
  const v = catalog.venues()[0]
  return {
    id: `evt-${Date.now().toString(36)}`,
    venueId: v.id,
    title: '',
    subtitle: '',
    category: v.kind === 'cinema' ? 'Movie' : v.kind === 'aircraft' ? 'Flight' : 'Football',
    date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    time: '20:00',
    prices: Object.fromEntries(v.layout.tiers.map((t) => [t.id, t.price])),
    status: 'draft',
  }
}

function EventEditor({ initial, onClose }: { initial: EventRecord; onClose: () => void }) {
  const [e, setE] = useState<EventRecord>(initial)
  const venues = catalog.venues()
  const venue = venues.find((v) => v.id === e.venueId)
  const set = <K extends keyof EventRecord>(k: K, v: EventRecord[K]) => setE((x) => ({ ...x, [k]: v }))

  const changeVenue = (id: string) => {
    const v = venues.find((x) => x.id === id)!
    setE((x) => ({
      ...x,
      venueId: id,
      category: v.kind === 'cinema' ? 'Movie' : v.kind === 'aircraft' ? 'Flight' : x.category === 'Movie' || x.category === 'Flight' ? 'Football' : x.category,
      prices: Object.fromEntries(v.layout.tiers.map((t) => [t.id, x.prices[t.id] ?? t.price])),
    }))
  }

  const save = (ev: React.FormEvent) => {
    ev.preventDefault()
    catalog.saveEvent({ ...e, title: e.title.trim() || 'Untitled event' })
    onClose()
  }

  return (
    <form onSubmit={save} className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-lg font-semibold">{catalog.event(e.id) ? 'Edit event' : 'New event'}</div>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input required value={e.title} onChange={(x) => set('title', x.target.value)} className={inputCls} placeholder="Lahore Lions vs …" />
        </Field>
        <Field label="Subtitle">
          <input value={e.subtitle} onChange={(x) => set('subtitle', x.target.value)} className={inputCls} placeholder="League · Matchday" />
        </Field>
        <Field label="Venue">
          <select value={e.venueId} onChange={(x) => changeVenue(x.target.value)} className={inputCls}>
            {venues.map((v) => (
              <option key={v.id} value={v.id} className="bg-ink">
                {v.layout.name} ({v.kind})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select value={e.category} onChange={(x) => set('category', x.target.value as EventCategory)} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c} className="bg-ink">
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" required value={e.date} onChange={(x) => set('date', x.target.value)} className={inputCls} />
        </Field>
        <Field label="Time">
          <input type="time" required value={e.time} onChange={(x) => set('time', x.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Prices (Rs)</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        {venue?.layout.tiers.map((t) => (
          <Field key={t.id} label={t.name}>
            <NumberInput value={e.prices[t.id] ?? t.price} min={0} step={100} onChange={(v) => set('prices', { ...e.prices, [t.id]: v })} />
          </Field>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={e.status === 'on-sale'}
            onChange={(x) => set('status', x.target.checked ? 'on-sale' : 'draft')}
            className="h-4 w-4 accent-[#7cf0b4]"
          />
          On sale (shown on the home page)
        </label>
        <button type="submit" className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-mint">
          <Save size={15} /> Save event
        </button>
      </div>
    </form>
  )
}

export function EventsTab({ events }: { events: EventRecord[] }) {
  const [editing, setEditing] = useState<EventRecord | null>(null)
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-semibold">Events</div>
          <button
            onClick={() => setEditing(blankEvent())}
            className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-mint"
          >
            <CalendarPlus size={15} /> New event
          </button>
        </div>
        {events.map((e) => {
          const v = catalog.venue(e.venueId)
          const min = Math.min(...Object.values(e.prices))
          return (
            <div key={e.id} className="glass flex items-center gap-4 rounded-2xl p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{e.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      e.status === 'on-sale' ? 'bg-mint/15 text-mint' : 'bg-white/10 text-muted'
                    }`}
                  >
                    {e.status === 'on-sale' ? 'On sale' : 'Draft'}
                  </span>
                </div>
                <div className="truncate text-[12px] text-muted">
                  {formatEventDate(e)} · {v?.layout.name ?? 'Missing venue'} · from {formatPrice(min)}
                </div>
              </div>
              <Link to={`/event/${e.id}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" title="Open booking page">
                <ExternalLink size={15} />
              </Link>
              <button onClick={() => setEditing(e)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" title="Edit">
                <Pencil size={15} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${e.title}"? Tickets already sold stay valid.`)) catalog.deleteEvent(e.id)
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-red-300 hover:bg-red-500/10"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>
      <div>
        {editing ? (
          <EventEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />
        ) : (
          <div className="glass rounded-3xl p-6 text-[13px] text-muted">
            Select an event to edit its date, venue and prices, or create a new one. Changes appear on the booking pages
            straight away, even in other open tabs.
          </div>
        )}
      </div>
    </div>
  )
}
