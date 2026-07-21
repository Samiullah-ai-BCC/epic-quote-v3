import { Outlet } from 'react-router-dom'
import Sidebar from './layout/Sidebar'

// Tailwind port of the legacy .app/.main shell rules in index.css (values copied 1:1).
export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden max-[900px]:flex-col">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-auto px-[34px] py-[26px] max-[900px]:px-3.5 max-[900px]:py-4">
        <Outlet />
      </main>
    </div>
  )
}
