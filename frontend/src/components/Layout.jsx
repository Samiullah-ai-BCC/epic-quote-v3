import { Outlet } from 'react-router-dom'
import Sidebar from './layout/Sidebar'
import ImpersonationBanner from './layout/ImpersonationBanner'

// Tailwind port of the legacy .app/.main shell rules in index.css (values copied 1:1).
export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden max-[900px]:flex-col">
      <Sidebar />
      {/* The "viewing as" banner lives INSIDE the scrolling column and sticks to its top, so it
          stays on screen on every page and at every scroll position while impersonating. */}
      <main className="min-h-0 flex-1 overflow-auto max-[900px]:px-3.5 max-[900px]:py-4">
        <ImpersonationBanner />
        <div className="px-[34px] py-[26px] max-[900px]:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
