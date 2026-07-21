import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useSelector } from 'react-redux'
import * as U from '../api/users'
import { useConstants } from '../hooks'
import { selectUser } from '../store/authSlice'
import { rise } from '../components/ui/motion'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../components/ui/table'
import AddUserDialog from '../components/users/AddUserDialog'
import UserRow from '../components/users/UserRow'

export default function Users() {
  const qc = useQueryClient()
  const me = useSelector(selectUser)
  const { data: constants } = useConstants()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: U.listUsers })

  const [showAdd, setShowAdd] = useState(false)

  const roles = constants?.roles || ['admin', 'sales_rep', 'manager']
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const create = useMutation({ mutationFn: U.createUser, onSuccess: () => { refresh(); setShowAdd(false) } })
  const update = useMutation({ mutationFn: ({ id, patch }) => U.updateUser(id, patch), onSuccess: refresh })
  const del = useMutation({ mutationFn: U.deleteUser, onSuccess: refresh })

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
        <div><h1>Users</h1><div className="sub">Team accounts, roles, and payment-link permission</div></div>
        <Button onClick={() => setShowAdd(true)}>+ Add User</Button>
      </div>

      {isLoading ? <div className="center">Loading…</div> : (
        <motion.div className="panel table-card overflow-auto" variants={rise} initial="hidden" animate="show">
          <Table className="num-table">
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead title="May generate Shopify payment links">Pay links</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  roles={roles}
                  isSelf={u.id === me?.id}
                  onPatch={(patch) => update.mutate({ id: u.id, patch })}
                  onResetPassword={() => resetPw(u)}
                  onDelete={() => remove(u)}
                />
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      <AddUserDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        roles={roles}
        onCreate={(values) => create.mutateAsync(values)}
      />
    </>
  )
}
