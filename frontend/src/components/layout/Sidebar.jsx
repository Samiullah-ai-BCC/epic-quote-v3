import { NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout, selectUser, selectIsAdmin } from '../../store/authSlice'
import { IcHome, IcQuotes, IcCard, IcTeam, IcUsers, IcReports, IcActivity } from '../icons'
import { cn } from '../../lib/utils'

// Tailwind port of the legacy .sidebar/.navlink rules in index.css (values copied 1:1).
// The max-[900px]: variants mirror the old @media (max-width: 900px) top-bar layout.

const linkBase =
  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-side-dim ' +
  'transition-colors duration-[120ms] hover:bg-side-hover hover:text-side-ink ' +
  '[&_svg]:shrink-0 [&_svg]:opacity-90 ' +
  'max-[900px]:px-2.5 max-[900px]:py-[7px] max-[900px]:text-[12.5px]'

const linkActive =
  'bg-gold-soft text-gold [&_svg]:opacity-100 ' +
  "before:content-[''] before:w-[3px] before:h-4 before:rounded-[2px] before:bg-gold before:-ml-3 before:mr-[9px] " +
  'max-[900px]:before:hidden'

function NavItem({ to, icon: Icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(linkBase, isActive && linkActive)}>
      <Icon size={17} /> {children}
    </NavLink>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const admin = useSelector(selectIsAdmin)

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  const name = user?.full_name || user?.username || ''
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = (words.length > 1 ? words.map((w) => w[0]).slice(0, 2).join('') : name.slice(0, 2)).toUpperCase() || 'U'

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen w-[236px] shrink-0 flex-col gap-[3px] border-r border-side-line bg-side px-3.5 py-[18px]',
        'max-[900px]:static max-[900px]:h-auto max-[900px]:w-full max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:items-center max-[900px]:gap-0.5 max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:px-3 max-[900px]:py-2.5'
      )}
    >
      <NavLink
        to="/dashboard"
        className="flex items-center gap-2.5 px-1.5 pt-1.5 pb-5 max-[900px]:p-0 max-[900px]:pr-2.5"
        title="Go to dashboard"
      >
        <img
          src="/quote-logo-t.png"
          alt="Epic Craftings"
          className="block h-auto w-full max-w-[188px] mix-blend-lighten max-[900px]:max-w-[110px]"
        />
      </NavLink>
      <NavItem to="/dashboard" icon={IcHome}>Dashboard</NavItem>
      <NavItem to="/quotes" icon={IcQuotes}>All Quotes</NavItem>
      <NavItem to="/payment-links" icon={IcCard}>Payment Links</NavItem>
      {admin && <NavItem to="/team" icon={IcTeam}>Team</NavItem>}
      {admin && <NavItem to="/users" icon={IcUsers}>Users</NavItem>}
      {admin && <NavItem to="/reports" icon={IcReports}>Sales Reports</NavItem>}
      {admin && <NavItem to="/activity" icon={IcActivity}>Activity Log</NavItem>}

      <div className="flex-1 max-[900px]:hidden" />
      <div className="border-t border-side-line px-2.5 pt-3 pb-1 max-[900px]:ml-auto max-[900px]:flex max-[900px]:items-center max-[900px]:gap-2 max-[900px]:border-t-0 max-[900px]:p-0 max-[900px]:pl-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-linear-135 from-gold to-[#d98a00] text-[13px] font-extrabold text-[#1a1206]">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-side-ink">{name}</div>
            <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-gold max-[900px]:hidden">
              {user?.role}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2.5 w-full cursor-pointer rounded-lg border border-side-line bg-transparent px-[11px] py-[5px] text-xs font-semibold tracking-[.01em] text-side-ink transition hover:bg-side-hover hover:shadow-none active:translate-y-px max-[900px]:mt-0 max-[900px]:w-auto"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
