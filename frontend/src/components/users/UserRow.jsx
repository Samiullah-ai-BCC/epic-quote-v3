import { TableCell, TableRow } from '../ui/table'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

/* One editable row of the Users table. Text fields save on blur (only when
   changed); role and pay-link permission save immediately. */
export default function UserRow({ user, roles, isSelf, onPatch, onResetPassword, onDelete, onImpersonate, onReset2fa }) {
  const saveOnBlur = (key) => (e) => {
    if (e.target.value !== (user[key] ?? '')) onPatch({ [key]: e.target.value })
  }

  return (
    <TableRow>
      <TableCell className="font-bold">{user.username}</TableCell>
      <TableCell><Input defaultValue={user.full_name} onBlur={saveOnBlur('full_name')} /></TableCell>
      <TableCell><Input defaultValue={user.email} onBlur={saveOnBlur('email')} /></TableCell>
      <TableCell>
        <Select defaultValue={user.role} onValueChange={(role) => onPatch({ role })}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          title={user.role === 'admin' ? 'Admins can always create payment links' : 'Allow this user to create Shopify payment links'}
          disabled={user.role === 'admin'}
          checked={!!user.can_create_payment_links}
          onCheckedChange={(checked) => onPatch({ can_create_payment_links: !!checked })}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-dim">
        {user.last_login ? new Date(user.last_login).toLocaleString() : '—'}
      </TableCell>
      <TableCell className="whitespace-nowrap space-x-1.5">
        <Button variant="outline" size="sm" onClick={onResetPassword}>Reset PW</Button>
        {/* "View as" is pointless on your own row — you are already yourself. */}
        {!isSelf && <Button variant="outline" size="sm" onClick={onImpersonate} title={`See the app as ${user.username} sees it`}>View as</Button>}
        {/* Only offered when the user actually HAS 2FA — otherwise it is a button that does
            nothing, and reads as if it might do something destructive. */}
        {user.two_factor_enabled && (
          <Button variant="outline" size="sm" onClick={onReset2fa} title="Clear their two-factor — use when a phone is lost">Reset 2FA</Button>
        )}
        {!isSelf && <Button variant="destructive" size="sm" onClick={onDelete}>Del</Button>}
      </TableCell>
    </TableRow>
  )
}
