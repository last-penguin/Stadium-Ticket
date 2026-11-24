import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ScanLine, Ticket as TicketIcon } from 'lucide-react'
import { backend } from '../services/live'
import type { Ticket } from '../services/tickets'
import { TicketCard } from '../ui/TicketCard'
import { Shell } from './Shell'

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>(() => backend.tickets())
  const [, force] = useState(0)

  // refresh when another tab buys or scans a ticket
  useEffect(() => {
    const refresh = () => {
      setTickets(backend.tickets())
      force((n) => n + 1)
    }
    window.addEventListener('storage', refresh)
    const t = setInterval(refresh, 2000)
    return () => {
      window.removeEventListener('storage', refresh)
      clearInterval(t)
    }
  }, [])

  return (
    <Shell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Wallet</div>
          <h1 className="font-display text-3xl font-semibold">My tickets</h1>
          <p className="mt-1 max-w-lg text-[14px] text-muted">
            Each QR code is digitally signed. The gate accepts it once, so a screenshot or a copy can't get in a second time.
          </p>
        </div>
        {tickets.length > 0 && (
          <Link to="/scan" className="glass flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-medium hover:bg-white/10">
            <ScanLine size={16} /> Open the gate scanner
          </Link>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="glass mx-auto max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
            <TicketIcon size={24} className="text-mint" />
          </div>
          <div className="mt-4 font-display text-xl font-semibold">No tickets yet</div>
          <p className="mt-1 text-[14px] text-muted">Pick a seat in the stadium, check the view, and book it.</p>
          <Link to="/" className="mt-5 inline-block rounded-2xl bg-white px-5 py-3 text-[14px] font-semibold text-ink hover:bg-mint">
            Explore the stadium
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map((t) => {
            const r = backend.authority.redemption(t.id)
            return <TicketCard key={t.id} ticket={t} status={{ used: !!r, at: r?.at, gate: r?.gate }} />
          })}
        </div>
      )}
    </Shell>
  )
}
