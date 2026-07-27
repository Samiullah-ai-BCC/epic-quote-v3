import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { selectImpersonator, selectUser, stopImpersonation } from '../../store/authSlice'

/* Loud, permanent, unmissable while an admin is viewing as someone else.

   It is deliberately garish and pinned above everything: the danger of "view as" is forgetting
   you are in it and mistaking another person's data for your own — or acting inside their
   account by accident. A subtle indicator would defeat the point. */

export default function ImpersonationBanner() {
  const impersonator = useSelector(selectImpersonator)
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  if (!impersonator) return null

  const back = async () => {
    setBusy(true)
    try {
      await dispatch(stopImpersonation()).unwrap()
      navigate('/users')
    } catch {
      // the borrowed token is gone but we could not restore the admin one — a clean re-login
      // is the only honest recovery, and is better than a silently broken session
      navigate('/login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-2 text-[13px] font-semibold text-amber-950 shadow-md">
      <span>
        Viewing as <b>{user?.full_name || user?.username}</b> — you are signed in as{' '}
        <b>{impersonator.full_name || impersonator.username}</b>.
      </span>
      <button
        onClick={back}
        disabled={busy}
        className="rounded-md border border-amber-900/40 bg-amber-950 px-2.5 py-1 text-xs font-bold text-amber-50 transition hover:bg-amber-900 disabled:opacity-60"
      >
        {busy ? 'Returning…' : 'Return to my account'}
      </button>
    </div>
  )
}
