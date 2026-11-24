import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Building2, Clapperboard, Eye, Minus, Plus, RotateCcw, Save } from 'lucide-react'
import { catalog, type VenueRecord } from '../../services/catalog'
import { GALAXY_CONFIG, type CinemaConfig } from '../../venue/cinema'
import { buildVenue } from '../../venue/models'
import { AURORA_CONFIG, type StadiumConfig } from '../../venue/stadium'
import type { PriceTier } from '../../venue/types'
import { SectorMap } from './SectorMap'
import { Field, inputCls, NumberInput } from './ui'

const clone = <T,>(x: T): T => structuredClone(x)

function TiersEditor({ tiers, onChange }: { tiers: PriceTier[]; onChange: (t: PriceTier[]) => void }) {
  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={t.id} className="grid grid-cols-[28px_1fr_120px] items-center gap-2">
          <input
            type="color"
            value={t.color}
            onChange={(e) => onChange(tiers.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
            className="h-7 w-7 cursor-pointer rounded-md border-0 bg-transparent"
            aria-label={`${t.name} colour`}
          />
          <input value={t.name} onChange={(e) => onChange(tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputCls} />
          <NumberInput value={t.price} min={0} step={100} onChange={(v) => onChange(tiers.map((x, j) => (j === i ? { ...x, price: v } : x)))} />
        </div>
      ))}
      <div className="text-[11px] text-muted">Base prices in Rs. Each event can override them.</div>
    </div>
  )
}

function StadiumEditor({ cfg, set }: { cfg: StadiumConfig; set: (c: StadiumConfig) => void }) {
  const ring = (i: number, patch: Partial<StadiumConfig['rings'][number]>) =>
    set({ ...cfg, rings: cfg.rings.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Tiers (rings)</div>
          <div className="flex gap-1">
            <button
              onClick={() => cfg.rings.length > 1 && set({ ...cfg, rings: cfg.rings.slice(0, -1) })}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 hover:bg-white/15"
              aria-label="Remove tier"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() =>
                cfg.rings.length < 4 &&
                set({
                  ...cfg,
                  rings: [
                    ...cfg.rings,
                    { name: `Tier ${cfg.rings.length + 1}`, shortName: `T${cfg.rings.length + 1}`, rows: 12, rowDepth: 0.9, rowRise: 0.6, gapBefore: 2.6, liftBefore: 3.8 },
                  ],
                })
              }
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 hover:bg-white/15"
              aria-label="Add tier"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 text-[10px] uppercase tracking-[0.12em] text-muted">
            <span>Name</span>
            <span>Rows</span>
            <span>Rise (m)</span>
            <span>Depth (m)</span>
          </div>
          {cfg.rings.map((r, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2">
              <input value={r.name} onChange={(e) => ring(i, { name: e.target.value, shortName: e.target.value.split(' ')[0] })} className={inputCls} />
              <NumberInput value={r.rows} min={2} max={40} onChange={(v) => ring(i, { rows: v })} />
              <NumberInput value={r.rowRise} min={0.2} max={0.9} step={0.02} onChange={(v) => ring(i, { rowRise: v })} />
              <NumberInput value={r.rowDepth} min={0.7} max={1.3} step={0.05} onChange={(v) => ring(i, { rowDepth: v })} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Sectors per stand</div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Sides">
            <NumberInput value={cfg.sectorsPerSegment.side} min={1} max={9} onChange={(v) => set({ ...cfg, sectorsPerSegment: { ...cfg.sectorsPerSegment, side: v } })} />
          </Field>
          <Field label="Ends">
            <NumberInput value={cfg.sectorsPerSegment.end} min={1} max={7} onChange={(v) => set({ ...cfg, sectorsPerSegment: { ...cfg.sectorsPerSegment, end: v } })} />
          </Field>
          <Field label="Corners">
            <NumberInput value={cfg.sectorsPerSegment.corner} min={1} max={4} onChange={(v) => set({ ...cfg, sectorsPerSegment: { ...cfg.sectorsPerSegment, corner: v } })} />
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Seat width (m)">
          <NumberInput value={cfg.seatWidth} min={0.45} max={0.8} step={0.01} onChange={(v) => set({ ...cfg, seatWidth: v })} />
        </Field>
        <Field label="Aisle (m)">
          <NumberInput value={cfg.aisleWidth} min={0.8} max={3} step={0.1} onChange={(v) => set({ ...cfg, aisleWidth: v })} />
        </Field>
        <Field label="Bowl length">
          <NumberInput value={cfg.shape.hx} min={56} max={90} onChange={(v) => set({ ...cfg, shape: { ...cfg.shape, hx: v } })} />
        </Field>
        <Field label="Bowl width">
          <NumberInput value={cfg.shape.hz} min={38} max={70} onChange={(v) => set({ ...cfg, shape: { ...cfg.shape, hz: v, r: Math.min(cfg.shape.r, v - 2) } })} />
        </Field>
      </div>
    </div>
  )
}

function CinemaEditor({ cfg, set }: { cfg: CinemaConfig; set: (c: CinemaConfig) => void }) {
  const sec = (i: number, patch: Partial<CinemaConfig['sections'][number]>) =>
    set({ ...cfg, sections: cfg.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Sections (front to back)</div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1.2fr_1fr] gap-2 text-[10px] uppercase tracking-[0.12em] text-muted">
            <span>Name</span>
            <span>Rows</span>
            <span>Seats/row</span>
            <span>Aisles after</span>
            <span>Tier</span>
          </div>
          {cfg.sections.map((s, i) => (
            <div key={i} className="grid grid-cols-[1.2fr_0.8fr_1fr_1.2fr_1fr] gap-2">
              <input value={s.name} onChange={(e) => sec(i, { name: e.target.value, shortName: e.target.value })} className={inputCls} />
              <NumberInput value={s.rows} min={1} max={15} onChange={(v) => sec(i, { rows: v })} />
              <NumberInput value={s.seatsPerRow} min={4} max={40} onChange={(v) => sec(i, { seatsPerRow: v })} />
              <input
                defaultValue={s.aislesAfter.join(', ')}
                onBlur={(e) =>
                  sec(i, {
                    aislesAfter: e.target.value
                      .split(',')
                      .map((x) => parseInt(x.trim(), 10))
                      .filter((n) => n > 0),
                  })
                }
                className={inputCls}
                placeholder="5, 17"
              />
              <select value={s.tierId} onChange={(e) => sec(i, { tierId: e.target.value })} className={inputCls}>
                {cfg.tiers.map((t) => (
                  <option key={t.id} value={t.id} className="bg-ink">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Screen width (m)">
          <NumberInput value={cfg.screen.width} min={6} max={30} step={0.5} onChange={(v) => set({ ...cfg, screen: { ...cfg.screen, width: v }, hall: { ...cfg.hall, width: Math.max(cfg.hall.width, v + 4) } })} />
        </Field>
        <Field label="Row rise (m)">
          <NumberInput value={cfg.rowRise} min={0.1} max={0.7} step={0.02} onChange={(v) => set({ ...cfg, rowRise: v })} />
        </Field>
        <Field label="Row curve radius">
          <NumberInput value={cfg.curveRadius} min={0} max={80} onChange={(v) => set({ ...cfg, curveRadius: v })} />
        </Field>
        <Field label="First row to screen">
          <NumberInput value={cfg.firstRowDistance} min={3} max={15} step={0.5} onChange={(v) => set({ ...cfg, firstRowDistance: v })} />
        </Field>
      </div>
    </div>
  )
}

export function VenuesTab() {
  const navigate = useNavigate()
  const venues = catalog.venues()
  const [selectedId, setSelectedId] = useState(venues[0]?.id)
  const stored = venues.find((v) => v.id === selectedId) ?? venues[0]
  const [draft, setDraft] = useState<VenueRecord>(() => clone(stored))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(clone(stored))
  }, [stored?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild the venue from the draft layout for the live preview.
  const [preview, setPreview] = useState(() => buildVenue(draft))
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setPreview(buildVenue(draft))
      } catch {
        /* keep the last good preview while values are mid-edit */
      }
    }, 120)
    return () => clearTimeout(t)
  }, [draft])

  const tierColor = useMemo(() => new Map(preview.venue.tiers.map((t) => [t.id, t.color])), [preview])
  const rows = preview.venue.rings.reduce((n, r) => n + r.rows, 0)
  const dirty = JSON.stringify(draft.layout) !== JSON.stringify(stored.layout)

  const newVenue = (kind: 'stadium' | 'cinema') => {
    const id = `${kind}-${Date.now().toString(36)}`
    const layout = kind === 'stadium' ? { ...clone(AURORA_CONFIG), id, name: 'New Stadium' } : { ...clone(GALAXY_CONFIG), id, name: 'New Cinema' }
    const rec = catalog.saveVenue({ id, kind, layout, updatedAt: 0 } as VenueRecord)
    setSelectedId(rec.id)
  }

  const save = () => {
    catalog.saveVenue(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }
  const firstEvent = catalog.events().find((e) => e.venueId === draft.id)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {venues.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedId(v.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
              v.id === draft.id ? 'bg-white text-ink' : 'glass text-white/75 hover:text-white'
            }`}
          >
            {v.kind === 'stadium' ? <Building2 size={13} /> : <Clapperboard size={13} />} {v.layout.name}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button onClick={() => newVenue('stadium')} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] hover:bg-white/10">
          <Plus size={13} /> Stadium
        </button>
        <button onClick={() => newVenue('cinema')} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] hover:bg-white/10">
          <Plus size={13} /> Cinema
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="glass space-y-5 rounded-3xl p-5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Venue name">
              <input
                value={draft.layout.name}
                onChange={(e) => setDraft((d) => ({ ...d, layout: { ...d.layout, name: e.target.value } }) as VenueRecord)}
                className={inputCls}
              />
            </Field>
            <Field label="City">
              <input
                value={draft.layout.city}
                onChange={(e) => setDraft((d) => ({ ...d, layout: { ...d.layout, city: e.target.value } }) as VenueRecord)}
                className={inputCls}
              />
            </Field>
          </div>
          {draft.kind === 'stadium' ? (
            <StadiumEditor cfg={draft.layout} set={(layout) => setDraft({ ...draft, layout })} />
          ) : (
            <CinemaEditor cfg={draft.layout} set={(layout) => setDraft({ ...draft, layout })} />
          )}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Price tiers</div>
            <TiersEditor
              tiers={draft.layout.tiers}
              onChange={(tiers) => setDraft((d) => ({ ...d, layout: { ...d.layout, tiers } }) as VenueRecord)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button
              onClick={save}
              disabled={!dirty}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition enabled:hover:bg-mint disabled:opacity-40"
            >
              <Save size={15} /> {saved ? 'Saved' : 'Save layout'}
            </button>
            <button
              onClick={() => setDraft(clone(stored))}
              disabled={!dirty}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] text-white/75 enabled:hover:bg-white/10 disabled:opacity-40"
            >
              <RotateCcw size={14} /> Discard changes
            </button>
            {firstEvent && (
              <button
                onClick={() => navigate(`/event/${firstEvent.id}`)}
                disabled={dirty}
                title={dirty ? 'Save first' : 'Open in 3D'}
                className="ml-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] text-white/85 enabled:hover:bg-white/10 disabled:opacity-40"
              >
                <Eye size={14} /> View in 3D
              </button>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-5 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[15px] font-semibold">Live seat plan</div>
              <div className="text-[12px] text-muted">Updates as you edit · coloured by price tier</div>
            </div>
            {dirty && <span className="rounded-full bg-amber-300/15 px-2.5 py-1 text-[11px] font-medium text-amber-200">Unsaved</span>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['Seats', preview.venue.seatCount.toLocaleString()],
              ['Sectors', String(preview.venue.sectors.length)],
              ['Rows', String(rows)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/[0.05] px-3 py-2.5">
                <div className="font-display text-xl font-semibold tabular">{v}</div>
                <div className="text-[11px] text-muted">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <SectorMap
              model={preview}
              height={380}
              showSeats={preview.venue.kind === 'cinema'}
              colorFor={(s) => tierColor.get(s.tierId) ?? '#666'}
              tooltip={(s) => (
                <>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-muted">
                    {s.seats.length} seats · {preview.venue.tiers.find((t) => t.id === s.tierId)?.name}
                  </div>
                </>
              )}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {preview.venue.tiers.map((t) => (
              <span key={t.id} className="flex items-center gap-1.5 text-[12px] text-muted">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: t.color }} /> {t.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
