import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as U from '../api/users'
import { useConstants } from '../hooks'
import useAuthStore from '../store/authStore'

const EMPTY = { username: '', full_name: '', email: '', role: 'sales_rep', password: '' }

export default function Users() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const { data: constants } = useConstants()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: U.listUsers })

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const roles = constants?.roles || ['admin', 'sales_rep', 'manager']
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const create = useMutation({ mutationFn: U.createUser, onSuccess: () => { refresh(); setShowAdd(false); setForm(EMPTY) } })
  const update = useMutation({ mutationFn: ({ id, patch }) => U.updateUser(id, patch), onSuccess: refresh })
  const del = useMutation({ mutationFn: U.deleteUser, onSuccess: refresh })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try { await create.mutateAsync(form) }
    catch (err) { setError(err.response?.data?.error || 'Failed to create user') }
  }

  const resetPw = async (u) => {
    const pw = window.prompt(`New password for ${u.username} (min 4 chars):`)
    if (!pw) return
    try { await U.changePassword(u.id, pw); alert('Password updated.') }
    catch (err) { alert(err.response?.data?.error || 'Failed') }
  }

  const remove = (u) => {
    if (window.confirm(`Delete user ${u.username}?`)) del.mutate(u.id)
  }

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        <button onClick={() => setShowAdd(true)}>+ Add User</button>
      </div>

      {isLoading ? <div className="center">Loading…</div> : (
        <table>
          <thead><tr><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th><th>Last Login</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.username}</b></td>
                <td><input defaultValue={u.full_name} onBlur={(e) => e.target.value !== u.full_name && update.mutate({ id: u.id, patch: { full_name: e.target.value } })} /></td>
                <td><input defaultValue={u.email} onBlur={(e) => e.target.value !== u.email && update.mutate({ id: u.id, patch: { email: e.target.value } })} /></td>
                <td>
                  <select defaultValue={u.role} style={{ width: 120 }} onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value } })}>
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="ghost sm" onClick={() => resetPw(u)}>Reset PW</button>{' '}
                  {u.id !== me?.id && <button className="danger sm" onClick={() => remove(u)}>Del</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <form className="modal" onSubmit={submit}>
            <h2>Add User</h2>
            <div className="grid2">
              <div className="field"><label>Username *</label><input value={form.username} onChange={set('username')} autoFocus /></div>
              <div className="field"><label>Full Name</label><input value={form.full_name} onChange={set('full_name')} /></div>
            </div>
            <div className="grid2">
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
              <div className="field"><label>Role</label>
                <select value={form.role} onChange={set('role')}>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </div>
            </div>
            <div className="field"><label>Password</label><input type="password" value={form.password} onChange={set('password')} /></div>
            {error && <p className="err">{error}</p>}
            <div className="foot">
              <button type="button" className="ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
