import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { login, twoFactorChallenge, confirmTwoFactorSetup, selectUser } from '../store/authSlice'
import { EASE } from '../components/ui/motion'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import BlueprintPanel from '../components/login/BlueprintPanel'
import LoginTwoFactorSetup from '../components/login/LoginTwoFactorSetup'

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

  // Set once the password is accepted but a second factor is still owed. Holding the challenge
  // in component state (never localStorage) means an abandoned half-login dies with the tab.
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [setup, setSetup] = useState(null)

  const onSubmit = async ({ username, password }) => {
    setError(''); setInfo('')
    try {
      const res = await dispatch(login({ username, password })).unwrap()
      if (res?.twoFactorSetupRequired) { setSetup(res); return }
      if (res?.twoFactorRequired) { setChallenge(res.challenge); return }   // ask for the code
      navigate('/dashboard')
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many attempts — wait a minute, then try again.')
      } else if (err.apiMisrouted) {
        // Deployment fault, not a credential fault — show it verbatim so nobody spends the
        // afternoon resetting passwords against a backend the app never reached.
        setError(err.message)
      } else {
        setError(err.response?.data?.errors?.username?.[0] || err.response?.data?.message || 'Login failed.')
      }
    }
  }

  const submitCode = async (e) => {
    e.preventDefault()
    setError(''); setVerifying(true)
    try {
      await dispatch(twoFactorChallenge({ challenge, code: code.trim() })).unwrap()
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'That code is not valid.'
      setError(msg)
      // An expired/void challenge cannot be retried — send them back to the password step
      // rather than leaving them typing codes into a challenge the server has already refused.
      if (/no longer valid|expired/i.test(msg)) { setChallenge(''); setCode('') }
    } finally {
      setVerifying(false)
    }
  }

  const submitSetupCode = async (setupCode) => {
    setError(''); setVerifying(true)
    try {
      await dispatch(confirmTwoFactorSetup({ challenge: setup.challenge, code: setupCode })).unwrap()
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'That code is not valid.'
      setError(msg)
      if (/no longer valid|expired/i.test(msg)) setSetup(null)
    } finally {
      setVerifying(false)
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

            {setup ? (
              <LoginTwoFactorSetup
                setup={setup}
                busy={verifying}
                error={error}
                onConfirm={submitSetupCode}
                onBack={() => { setSetup(null); setError('') }}
              />
            ) : challenge ? (
              /* Second factor. Replaces the credential form entirely — leaving the password
                 fields on screen invites re-submitting them and losing the challenge. */
              <form onSubmit={submitCode}>
                <Label className="text-xs font-semibold text-side-dim mb-1.5 block">Authentication code</Label>
                <Input
                  value={code} onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric" autoFocus autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className="h-[46px] mb-2 tracking-[0.3em] text-center bg-[#0a1220] border-[#25364f] text-side-ink placeholder:text-[#52688c] placeholder:tracking-normal focus-visible:border-gold focus-visible:ring-gold/15"
                />
                <div className="text-[12px] text-side-dim mb-4">
                  Open your authenticator app and enter the current code. You can also use one of your recovery codes.
                </div>

                {error && (
                  <motion.div
                    className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 mb-3.5"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    {error}
                  </motion.div>
                )}

                <Button type="submit" disabled={verifying || !code.trim()}
                  className="w-full h-11 bg-gold text-[#1a1305] font-bold text-sm hover:bg-gold-h shadow-[0_6px_20px_rgba(249,166,0,.25)]">
                  {verifying ? 'Verifying…' : 'Verify'}
                </Button>
                <button type="button" onClick={() => { setChallenge(''); setCode(''); setError('') }}
                  className="w-full mt-3 text-[12.5px] text-side-dim hover:text-side-ink bg-transparent border-0">
                  ← Back to sign in
                </button>
              </form>
            ) : (
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
            )}

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
