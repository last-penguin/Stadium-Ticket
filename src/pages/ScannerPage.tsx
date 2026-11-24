import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import jsQR from 'jsqr'
import { Camera, CameraOff, CheckCircle2, ImageUp, ShieldAlert, ShieldX, Sparkles, TriangleAlert } from 'lucide-react'
import { backend } from '../services/live'
import { forge, type RedeemResult } from '../services/tickets'
import { catalog, formatEventDate } from '../services/catalog'
import { Shell } from './Shell'

const GATES = ['Gate A', 'Gate B', 'Gate C', 'Gate D']

interface LogEntry {
  id: number
  at: number
  result: RedeemResult
}

const seatText = (seatId: string) => {
  const [sector, row, seat] = seatId.split('-')
  return `${/^\d+$/.test(sector) ? 'Sector ' : 'Block '}${sector} · Row ${row} · Seat ${seat}`
}
const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function ResultCard({ result }: { result: RedeemResult }) {
  if (result.status === 'valid') {
    return (
      <div className="rounded-3xl border border-mint/30 bg-mint/10 p-6">
        <CheckCircle2 size={34} className="text-mint" />
        <div className="mt-3 font-display text-2xl font-semibold text-mint">Valid · let them in</div>
        <div className="mt-1 text-[15px]">{seatText(result.payload.s)}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {result.payload.n} · {result.payload.t} · admitted at {result.gate}, {time(result.at)}
        </div>
      </div>
    )
  }
  if (result.status === 'used') {
    return (
      <div className="rounded-3xl border border-amber-300/30 bg-amber-300/10 p-6">
        <TriangleAlert size={34} className="text-amber-300" />
        <div className="mt-3 font-display text-2xl font-semibold text-amber-200">Already used</div>
        <div className="mt-1 text-[15px]">{seatText(result.payload.s)}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          This ticket went through {result.gate} at {time(result.at)}. A copy or screenshot can't be used again.
        </div>
      </div>
    )
  }
  if (result.status === 'wrong-event') {
    return (
      <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6">
        <ShieldAlert size={34} className="text-red-300" />
        <div className="mt-3 font-display text-2xl font-semibold text-red-200">Wrong event</div>
        <div className="mt-0.5 text-[13px] text-muted">This ticket is genuine but is for a different event.</div>
      </div>
    )
  }
  return (
    <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6">
      <ShieldX size={34} className="text-red-300" />
      <div className="mt-3 font-display text-2xl font-semibold text-red-200">
        {result.reason === 'bad-signature' ? 'Fake ticket' : 'Not a SeatView ticket'}
      </div>
      <div className="mt-0.5 text-[13px] text-muted">
        {result.reason === 'bad-signature'
          ? "The signature doesn't match. Someone changed the ticket's details, so it is refused."
          : "This QR code isn't a SeatView ticket."}
      </div>
    </div>
  )
}

export function ScannerPage() {
  const [gate, setGate] = useState(GATES[0])
  const events = catalog.events()
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [result, setResult] = useState<RedeemResult | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [camOn, setCamOn] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)
  const [picked, setPicked] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busy = useRef(false)
  const lastCode = useRef<{ code: string; at: number } | null>(null)
  const tickets = backend.tickets().filter((t) => t.eventId === eventId)

  const handle = useCallback(
    async (code: string) => {
      // ignore the same code held in front of the camera for a few seconds
      const now = Date.now()
      if (lastCode.current && lastCode.current.code === code && now - lastCode.current.at < 3000) return
      lastCode.current = { code, at: now }
      busy.current = true
      const r = await backend.authority.redeem(code, gate, eventId)
      setResult(r)
      setLog((l) => [{ id: now, at: now, result: r }, ...l].slice(0, 12))
      try {
        navigator.vibrate?.(r.status === 'valid' ? 80 : [60, 60, 60])
      } catch {
        /* ignore */
      }
      busy.current = false
    },
    [gate, eventId],
  )

  // camera decode loop
  useEffect(() => {
    if (!camOn) return
    let raf = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const v = videoRef.current!
        v.srcObject = stream
        await v.play()
        const tick = () => {
          if (stopped) return
          if (v.readyState >= 2 && !busy.current) {
            const w = 480
            const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360
            canvas.width = w
            canvas.height = h
            ctx.drawImage(v, 0, 0, w, h)
            const img = ctx.getImageData(0, 0, w, h)
            const qr = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
            if (qr?.data) handle(qr.data)
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setCamError('No camera available here. Use "Upload a screenshot" or the demo buttons instead.')
        setCamOn(false)
      }
    })()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [camOn, handle])

  const onUpload = async (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, c.width, c.height)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      const qr = jsQR(data.data, c.width, c.height)
      URL.revokeObjectURL(url)
      if (qr?.data) {
        lastCode.current = null
        handle(qr.data)
      } else {
        setResult({ status: 'invalid', reason: 'malformed' })
      }
    }
    img.src = url
  }

  const pickedTicket = tickets.find((t) => t.id === picked) ?? tickets[0]

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Staff</div>
          <h1 className="font-display text-3xl font-semibold">Gate scanner</h1>
          <p className="mt-1 max-w-xl text-[14px] text-muted">
            Checks each ticket's signature and lets it in only once. Scanning the same ticket again, or a copy of it, is
            refused.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="glass rounded-full px-3 py-2 text-[12px] font-medium outline-none"
          aria-label="Event being scanned"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id} className="bg-ink">
              {ev.title} · {formatEventDate(ev)}
            </option>
          ))}
        </select>
        <div className="glass flex rounded-full p-1">
          {GATES.map((g) => (
            <button
              key={g}
              onClick={() => setGate(g)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${gate === g ? 'bg-white text-ink' : 'text-white/70 hover:text-white'}`}
            >
              {g}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className="glass relative aspect-[4/3] overflow-hidden rounded-3xl">
            <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${camOn ? '' : 'hidden'}`} />
            {!camOn && (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <Camera size={30} className="mx-auto text-white/40" />
                  <div className="mt-3 text-[14px] text-muted">{camError ?? 'Point the camera at a ticket QR code.'}</div>
                </div>
              </div>
            )}
            {/* scan frame */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative h-[58%] aspect-square">
                {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((c) => (
                  <span key={c} className={`absolute h-8 w-8 rounded-sm border-mint ${c}`} />
                ))}
                {camOn && <div className="absolute inset-x-2 top-1/2 h-px animate-pulse bg-mint/80 shadow-[0_0_12px_#7cf0b4]" />}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setCamError(null)
                setCamOn((v) => !v)
              }}
              className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-mint"
            >
              {camOn ? <CameraOff size={16} /> : <Camera size={16} />} {camOn ? 'Stop camera' : 'Start camera'}
            </button>
            <label className="glass flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-medium hover:bg-white/10">
              <ImageUp size={16} /> Upload a screenshot
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onUpload(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
              <Sparkles size={13} /> Demo tools
            </div>
            {tickets.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">Book a ticket first, then come back here to scan it.</p>
            ) : (
              <>
                <select
                  value={pickedTicket?.id}
                  onChange={(e) => setPicked(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-ink px-3 py-2.5 text-[14px]"
                >
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.sectorLabel}, Row {t.row}, Seat {t.seat} · {t.holderName}
                    </option>
                  ))}
                </select>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      lastCode.current = null
                      if (pickedTicket) handle(pickedTicket.code)
                    }}
                    className="rounded-xl bg-white/10 px-3 py-2.5 text-[13px] font-medium hover:bg-white/15"
                  >
                    Scan this ticket
                  </button>
                  <button
                    onClick={() => {
                      lastCode.current = null
                      if (pickedTicket) handle(forge(pickedTicket.code))
                    }}
                    className="rounded-xl bg-white/10 px-3 py-2.5 text-[13px] font-medium hover:bg-white/15"
                  >
                    Try an edited (fake) copy
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Tip: scan the same ticket twice to see the second scan refused.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {result ? (
            <motion.div key={log[0]?.id ?? 'r'} initial={{ opacity: 0.4, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
              <ResultCard result={result} />
            </motion.div>
          ) : (
            <div className="glass rounded-3xl p-6 text-[14px] text-muted">Waiting for a ticket…</div>
          )}
          <div className="glass rounded-3xl p-5">
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Recent scans · {gate}</div>
            {log.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">No scans yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-white/5">
                {log.map((e) => {
                  const r = e.result
                  const label = r.status === 'valid' ? 'Valid' : r.status === 'used' ? 'Already used' : r.status === 'wrong-event' ? 'Wrong event' : r.reason === 'bad-signature' ? 'Fake' : 'Unreadable'
                  const color = r.status === 'valid' ? 'text-mint' : r.status === 'used' ? 'text-amber-300' : 'text-red-300'
                  return (
                    <li key={e.id} className="flex items-center justify-between py-2 text-[13px]">
                      <span className="text-white/80">{'payload' in r ? seatText(r.payload.s) : '-'}</span>
                      <span className="flex items-center gap-3">
                        <span className={`font-medium ${color}`}>{label}</span>
                        <span className="tabular text-muted">{time(e.at)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
