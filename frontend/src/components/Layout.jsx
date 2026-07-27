import { Outlet } from 'react-router-dom'
import Sidebar from './layout/Sidebar'
import ImpersonationBanner from './layout/ImpersonationBanner'

// Tailwind port of the legacy .app/.main shell rules in index.css (values copied 1:1).
export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden max-[900px]:flex-col">
      <Sidebar />
      {/* The banner is a SIBLING above <main>, not a wrapper inside it. Nesting the page in an
          extra padded div moved the scroll container's edge: a wide table (All Quotes) then
          overflowed that inner div instead of <main>, so its horizontal scrollbar sat at the
          bottom of the whole page and you had to scroll down to reach it. <main> keeps exactly
          the geometry it always had, and the banner still stays put while the page scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ImpersonationBanner />
        <main className="min-h-0 flex-1 overflow-auto px-[34px] py-[26px] max-[900px]:px-3.5 max-[900px]:py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
