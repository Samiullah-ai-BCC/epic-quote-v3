import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

const userSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  full_name: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.string().min(1),
  password: z.string().min(4, 'Password must be at least 4 characters'),
})

export default function AddUserDialog({ open, onOpenChange, roles, onCreate }) {
  const [serverError, setServerError] = useState('')
  const {
    register, handleSubmit, control, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { username: '', full_name: '', email: '', role: 'sales_rep', password: '' },
  })

  const onSubmit = async (values) => {
    setServerError('')
    try {
      await onCreate(values)
      reset()
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to create user')
    }
  }

  const firstError = Object.values(errors)[0]?.message || serverError

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nu-username">Username *</Label>
              <Input id="nu-username" autoFocus {...register('username')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nu-fullname">Full Name</Label>
              <Input id="nu-fullname" {...register('full_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nu-email">Email</Label>
              <Input id="nu-email" type="email" {...register('email')} />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Controller name="role" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nu-password">Password</Label>
            <Input id="nu-password" type="password" {...register('password')} />
          </div>
          {firstError && <p className="text-sm text-danger">{firstError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
