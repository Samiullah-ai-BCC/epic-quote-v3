import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { login, selectUser } from '../store/authSlice'
import { EASE } from '../components/ui/motion'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import BlueprintPanel from '../components/login/BlueprintPanel'

/* Estimator sign-in — internal team entry. The public app went light, but this
   page stays premium dark, so its surfaces use explicit dark classes. */

const loginSchema = z.object({
  username: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
})

export default function Login() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector(selectUser)

  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })

  // already signed in → straight to the dashboard (no marketing in-between)
  useEffect(() => { if (user) navigate('/dashboard', { replace: true }) }, [user, navigate])

  const onSubmit = async ({ username, password }) => {
    setError(''); setInfo('')
    try {
      await dispatch(login({ username, password })).unwrap()
      navigate('/dashboard')
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many attempts — wait a minute, then try again.')
      } else {
        setError(err.response?.data?.errors?.username?.[0] || err.response?.data?.message || 'Login failed.')
      }
    }
  }

  const fieldError = errors.username?.message || errors.password?.message

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#070a12] font-sans text-side-ink">
      <motion.div
        className="flex w-full max-w-[1000px] min-h-[580px] bg-[#0d1626] border border-[#1c2a44] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.55)] max-[760px]:max-w-[380px] max-[760px]:min-h-0"
        initial={{ opacity: 0, y: 20, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: EASE }}>

        <BlueprintPanel />

        <div className="flex-1 flex items-center justify-center p-10">
          <motion.div className="w-[340px]"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.18 }}>
            <img src="/quote-logo-t.png" alt="Epic Craftings" className="h-[78px] block mb-4" />
            <div className="text-[13px] text-[#7f93b5] mb-6">Sign in to continue</div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Label className="text-xs font-semibold text-side-dim mb-1.5 block">Email or username</Label>
              <Input
                {...register('username')}
                type="text" placeholder="name@epiccraftings.com"
                autoCapitalize="none" autoCorrect="off" autoFocus
                className="h-[46px] mb-4 bg-[#0a1220] border-[#25364f] text-side-ink placeholder:text-[#52688c] focus-visible:border-gold focus-visible:ring-gold/15"
              />

              <div className="flex justify-between items-baseline mb-1.5">
                <Label className="text-xs font-semibold text-side-dim">Password</Label>
                <span
                  className="text-xs text-gold font-semibold cursor-pointer hover:text-gold-h"
                  onClick={() => setInfo('Ask your administrator to reset your password.')}>
                  Forgot password?
                </span>
              </div>
              <div className="relative mb-4">
                <Input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'} placeholder="Enter your password"
                  className="h-[46px] pr-11 bg-[#0a1220] border-[#25364f] text-side-ink placeholder:text-[#52688c] focus-visible:border-gold focus-visible:ring-gold/15"
                />
                <button type="button"
                  className="absolute right-1.5 top-[7px] h-8 w-8 flex items-center justify-center text-[#8497b6] opacity-80 hover:opacity-100 bg-transparent border-0 p-0 shadow-none"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {(error || fieldError) && (
                <motion.div
                  className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 mb-3.5"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  {error || fieldError}
                </motion.div>
              )}
              {info && <div className="text-[12.5px] text-side-dim mb-3.5">{info}</div>}

              <Button type="submit" disabled={isSubmitting}
                className="w-full h-11 bg-gold text-[#1a1305] font-bold text-sm hover:bg-gold-h shadow-[0_6px_20px_rgba(249,166,0,.25)]">
                {isSubmitting ? 'Signing in…' : 'Log in'}
              </Button>
            </form>

            <div className="flex items-center gap-3 mt-[22px] mb-3.5">
              <span className="flex-1 h-px bg-[#1f2e47]" />
              <b className="text-[11px] text-[#5b6e90] tracking-wider font-semibold">EPIC CRAFTINGS TEAM</b>
              <span className="flex-1 h-px bg-[#1f2e47]" />
            </div>
            <div className="text-center text-[12.5px] text-[#6f84a8]">Need access? Contact your administrator.</div>
          </motion.div>
        </div>

      </motion.div>
    </div>
  )
}
