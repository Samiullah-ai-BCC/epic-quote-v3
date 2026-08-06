import { useSelector } from 'react-redux'
import { selectUser } from '../store/authSlice'
import TwoFactorPanel from '../components/settings/TwoFactorPanel'
import BankDetailsPanel from '../components/settings/BankDetailsPanel'

/* "My account" — the one place a person manages their OWN sign-in, regardless of role.
   Kept separate from /users (which is admin-only account administration): every rep needs
   to reach their second factor, not just admins. */

export default function Account() {
  const user = useSelector(selectUser)

  return (
    <div className="max-w-[820px]">
      <h1 className="text-[22px] font-extrabold tracking-tight">My account</h1>
      <p className="text-[13px] text-muted-foreground mt-1 mb-5">
        Signed in as <b>{user?.full_name || user?.username}</b>
        {user?.email ? <> · {user.email}</> : null}
      </p>

      <div className="grid gap-4">
        <TwoFactorPanel />
        {/* Company-wide, not personal — but this is the only settings surface the app has, and
            the details have to be reachable by the admins who maintain them. Reps see the panel
            read-only, which is also how they learn the numbers exist. */}
        <BankDetailsPanel />
      </div>
    </div>
  )
}
