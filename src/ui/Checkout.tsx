import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import confetti from 'canvas-confetti'
import { CheckCircle2, CreditCard, Loader2, Lock, Timer, X } from 'lucide-react'
import { announce, backend, holderId } from '../services/live'
import type { Ticket } from '../services/tickets'
import { currentEvent, getSeat, getSector, tierOf, useStore, venueModel } from '../state/store'
import { formatPrice } from '../venue/format'
import { formatEventDate } from '../services/catalog'
import { TicketCard } from './TicketCard'

export const serviceFee = (price: number) => Math.round((price * 0.05) / 10) * 10

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [active])
  return now
}

function HoldTimer({ expiresAt }: { expiresAt: number }) {
  const now = useNow(true)
  const left = Math.max(0, expiresAt - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  const urgent = left < 60000
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold tabular ${
        urgent ? 'bg-red-500/15 text-red-300' : 'bg-mint/15 text-mint'
      }`}
    >
      <Timer size={13} /> Seat held · {m}:{String(s).padStart(2, '0')}
    </div>
  )
}

type Phase = 'form' | 'processing' | 'done'

export function Checkout() {
  const open = useStore((s) => s.checkoutOpen)
  const myHold = useStore((s) => s.myHold)
  const snapshots = useStore((s) => s.snapshots)
  const [phase, setPhase] = useState<Phase>('form')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [heldSeatId, setHeldSeatId] = useState<string | null>(null)

  // Remember which seat this checkout is for, even after the hold ends.
  useEffect(() => {
    if (open && myHold) setHeldSeatId(myHold.seatId)
    if (!open) {
      setPhase('form')
      setTicket(null)
      setError(null)
    }
  }, [open, myHold])

  const seat = getSeat(heldSeatId)
  const sector = seat ? getSector(seat.sectorId) : null
  const tier = sector ? tierOf(sector) : null
  const expired = phase === 'form' && open && !myHold

  const close = async () => {
    if (phase !== 'done') {
      await backend.release(holderId)
      announce()
    }
    useStore.getState().setCheckoutOpen(false)
    if (phase === 'done') useStore.getState().goOverview()
  }

  const pay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!seat || !sector || !tier) return
    setError(null)
    setPhase('processing')
    await new Promise((r) => setTimeout(r, 1400)) // simulated payment provider
    const ring = venueModel.venue.rings[sector.ringIndex]
    const res = await backend.purchase(
      seat.id,
      holderId,
      { name: name.trim(), email: email.trim() },
      {
        eventId: currentEvent.id,
        eventTitle: currentEvent.title,
        eventDate: formatEventDate(currentEvent),
        venueName: `${venueModel.venue.name}, ${venueModel.venue.city}`,
        seatId: seat.id,
        sectorLabel: sector.label,
        standName: sector.standName,
        ringName: ring.name,
        row: seat.rowLabel,
        seat: seat.number,
        price: tier.price + serviceFee(tier.price),
      },
    )
    if (!res.ok) {
      setPhase('form')
      setError(
        res.reason === 'expired'
          ? 'Your 10-minute hold ran out and the seat was released. Please pick it again.'
          : 'This seat was just bought by someone else.',
      )
      announce()
      return
    }
    announce()
    setTicket(res.ticket)
    setPhase('done')
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.35 }, colors: ['#7cf0b4', '#ffffff', '#ffb547', '#4f8cff'] })
  }

  const input =
    'w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[14px] outline-none transition placeholder:text-white/30 focus:border-mint/60 focus:bg-white/[0.08]'

  return (
    <AnimatePresence>
      {open && seat && sector && tier && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={phase === 'processing' ? undefined : close} />
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="glass absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto sm:inset-y-3 sm:right-3 sm:w-[440px] sm:rounded-3xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Step 4 of 4</div>
                <div className="font-display text-lg font-semibold">{phase === 'done' ? "You're in!" : 'Checkout'}</div>
              </div>
              <div className="flex items-center gap-2">
                {phase !== 'done' && myHold && <HoldTimer expiresAt={myHold.expiresAt} />}
                {phase !== 'processing' && (
                  <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {phase === 'done' && ticket ? (
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-2 rounded-2xl bg-mint/10 px-4 py-3 text-[13px] text-mint">
                  <CheckCircle2 size={17} className="mt-px shrink-0" />
                  <span>
                    Paid {formatPrice(ticket.price)} (demo). Your ticket is signed and can be scanned once at the gate.
                  </span>
                </div>
                <TicketCard ticket={ticket} />
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/tickets"
                    onClick={() => {
                      useStore.getState().setCheckoutOpen(false)
                      useStore.getState().goOverview()
                    }}
                    className="rounded-2xl bg-white px-4 py-3 text-center text-[14px] font-semibold text-ink transition hover:bg-mint"
                  >
                    My tickets
                  </Link>
                  <button
                    onClick={close}
                    className="rounded-2xl border border-white/15 px-4 py-3 text-[14px] font-medium transition hover:bg-white/10"
                  >
                    Back to stadium
                  </button>
                </div>
                <p className="text-center text-[11px] text-muted">Gates open 90 minutes before kick-off.</p>
              </div>
            ) : (
              <form onSubmit={pay} className="flex flex-1 flex-col gap-5 p-5">
                {/* summary */}
                <div className="overflow-hidden rounded-2xl border border-line">
                  {snapshots[seat.id] && (
                    <img src={snapshots[seat.id]} alt="Your view" className="aspect-[16/8] w-full object-cover" />
                  )}
                  <div className="p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: tier.color }}>
                      {tier.name} · {sector.standName}
                    </div>
                    <div className="font-display text-[17px] font-semibold tabular">
                      {sector.label}, Row {seat.rowLabel}, Seat {seat.number}
                    </div>
                    <div className="text-[12px] text-muted">
                      {currentEvent.title} · {formatEventDate(currentEvent)}
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px]">
                      <div className="flex justify-between text-muted">
                        <span>Ticket</span>
                        <span className="tabular">{formatPrice(tier.price)}</span>
                      </div>
                      <div className="flex justify-between text-muted">
                        <span>Service fee</span>
                        <span className="tabular">{formatPrice(serviceFee(tier.price))}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="tabular">{formatPrice(tier.price + serviceFee(tier.price))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {expired ? (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-[13px] text-red-200">
                    Your hold ran out, so the seat was released for other fans. Close this and pick the seat again if it is
                    still free.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Your details</div>
                      <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} />
                      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for your ticket" className={input} />
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Payment</div>
                        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                          Demo mode
                        </span>
                      </div>
                      <div className="relative">
                        <CreditCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                        <input readOnly value="4242 4242 4242 4242" className={`${input} pl-10 text-white/60`} aria-label="Test card number" />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <input readOnly value="12 / 34" className={`${input} text-white/60`} aria-label="Test expiry" />
                        <input readOnly value="123" className={`${input} text-white/60`} aria-label="Test CVC" />
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted">
                        This is a test checkout. The card above is a fixed test number and no money is charged.
                      </p>
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-[13px] text-red-200">{error}</div>
                    )}

                    <button
                      type="submit"
                      disabled={phase === 'processing'}
                      className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-[15px] font-semibold text-ink transition hover:bg-mint disabled:opacity-70"
                    >
                      {phase === 'processing' ? (
                        <>
                          <Loader2 size={17} className="animate-spin" /> Confirming your seat…
                        </>
                      ) : (
                        <>
                          <Lock size={15} /> Pay {formatPrice(tier.price + serviceFee(tier.price))} · demo
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
