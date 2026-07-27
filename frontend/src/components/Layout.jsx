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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        {/* min-w-0 IS LOAD-BEARING. A flex item defaults to min-width:auto, i.e. it refuses to
              shrink below its content — so a 2210px-wide quotes table inflated <main> to 2293px
              inside a 1280px window. The shell's overflow-hidden then CLIPPED the excess, and
              .grid-wrap never scrolled (scrollWidth == clientWidth), so the table's right-hand
              columns were unreachable with no horizontal scrollbar anywhere. With min-w-0 main
              stays viewport-width and .grid-wrap shows its own slider, on screen. */}
        <main className="min-h-0 min-w-0 flex-1 overflow-auto px-[34px] py-[26px] max-[900px]:px-3.5 max-[900px]:py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
