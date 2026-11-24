import { Link, NavLink } from 'react-router'
import { LayoutDashboard, ScanLine, Sparkles, Ticket } from 'lucide-react'

/** Header + background used by the non-3D pages. */
export function Shell({ children }: { children: React.ReactNode }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
      isActive ? 'bg-white text-ink' : 'text-white/70 hover:text-white'
    }`
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(1200px_600px_at_70%_-10%,#1b2a3f_0%,#0b0e14_60%)]">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/70 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#141922" />
              <ellipse cx="16" cy="17" rx="11" ry="8" fill="none" stroke="#7cf0b4" strokeWidth="2.5" />
              <rect x="11" y="13.5" width="10" height="7" rx="1.5" fill="#7cf0b4" />
            </svg>
            <span className="font-display text-[17px] font-semibold tracking-tight">SeatView</span>
          </Link>
          <nav className="glass flex rounded-full p-1">
            <NavLink to="/" end className={tab}>
              <Sparkles size={14} /> <span className="hidden sm:inline">Events</span>
            </NavLink>
            <NavLink to="/tickets" className={tab}>
              <Ticket size={14} /> <span className="hidden sm:inline">My tickets</span>
            </NavLink>
            <NavLink to="/scan" className={tab}>
              <ScanLine size={14} /> <span className="hidden sm:inline">Gate scanner</span>
            </NavLink>
            <NavLink to="/admin" className={tab}>
              <LayoutDashboard size={14} /> <span className="hidden sm:inline">Admin</span>
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
