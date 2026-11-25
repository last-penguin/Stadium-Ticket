import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CalendarDays, MapPin } from 'lucide-react'
import type { Ticket } from '../services/tickets'
import { formatPrice } from '../venue/format'

export function useQr(code: string, size = 360) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(code, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0e14', light: '#ffffff' } })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null))
    return () => {
      alive = false
    }
  }, [code, size])
  return url
}

/** Printed-ticket style card with the signed QR code. */
export function TicketCard({ ticket, status }: { ticket: Ticket; status?: { used: boolean; at?: number; gate?: string } }) {
  const qr = useQr(ticket.code)
  const used = status?.used
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#f6f7f9] text-ink shadow-2xl">
      <div className="bg-ink px-5 pb-4 pt-5 text-white">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
          <span>{ticket.seatLabel ? 'Boarding pass' : 'SeatView ticket'}</span>
          <span className={used ? 'text-amber-300' : 'text-mint'}>{used ? 'Used' : 'Valid'}</span>
        </div>
        <div className="mt-2 font-display text-lg font-semibold leading-tight">{ticket.eventTitle}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/60">
          <span className="flex items-center gap-1">
            <CalendarDays size={11} /> {ticket.eventDate}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={11} /> {ticket.venueName}
          </span>
        </div>
      </div>
      {/* perforation */}
      <div className="relative h-0">
        <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-ink/90" />
        <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-ink/90" />
      </div>
      <div className="grid grid-cols-4 gap-2 px-5 pt-5 text-center">
        {(ticket.seatLabel
          ? [
              ['Seat', ticket.seatLabel],
              ['Row', String(ticket.row)],
              ['Class', ticket.ringName],
              ['Zone', ticket.sectorLabel.split(' · ')[1] ?? '—'],
            ]
          : [
              [/^\d+$/.test(ticket.seatId.split('-')[0]) ? 'Sector' : 'Block', ticket.seatId.split('-')[0]],
              ['Row', String(ticket.row)],
              ['Seat', String(ticket.seat)],
              ['Tier', ticket.ringName.split(' ')[0]],
            ]
        ).map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink/50">{k}</div>
            <div className="font-display text-xl font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pt-1 text-center text-[11px] text-ink/55">{ticket.standName}</div>
      <div className="relative mx-auto mt-4 w-[200px]">
        {qr ? (
          <img src={qr} alt="Ticket QR code" className={`w-full rounded-xl ${used ? 'opacity-30 grayscale' : ''}`} />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-xl bg-ink/10" />
        )}
        {used && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="-rotate-12 rounded-lg border-2 border-amber-600 px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-amber-700">
              Scanned{status?.gate ? ` · ${status.gate}` : ''}
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 px-5 pb-5 text-center">
        <div className="font-mono text-[11px] tracking-wider text-ink/60">{ticket.id}</div>
        <div className="mt-1 text-[11px] text-ink/50">
          {ticket.holderName} · {formatPrice(ticket.price)} · Signed and valid for one entry
        </div>
      </div>
    </div>
  )
}
