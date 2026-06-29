import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

/* Estimator sign-in — internal team entry. Professional, restrained:
   a technical-blueprint left panel + a clean auth form. Self-contained (.ecsign). */

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const user = useAuthStore((s) => s.user)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // already signed in → straight to the dashboard (no marketing in-between)
  useEffect(() => { if (user) navigate('/dashboard', { replace: true }) }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.errors?.username?.[0] || err.response?.data?.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ecsign">
      <style>{CSS}</style>
      <div className="ecsign-card">

        <div className="ecsign-panel">
          <span className="ecsign-tag">Estimator</span>
          <svg viewBox="0 0 360 230" className="ecsign-bp" aria-hidden="true">
            <defs>
              <pattern id="ecbp" width="22" height="22" patternUnits="userSpaceOnUse">
                <path d="M22 0H0V22" fill="none" stroke="#1b2840" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="360" height="230" fill="url(#ecbp)" opacity="0.55" />
            <rect x="78" y="74" width="224" height="88" rx="8" fill="none" stroke="#f9a600" strokeWidth="1.1" opacity="0.85" />
            <text x="190" y="132" textAnchor="middle" fontFamily="Inter" fontWeight="800" fontSize="40" fill="none" stroke="#f3f6fb" strokeWidth="0.8" opacity="0.6" letterSpacing="3">EPIC</text>
            <g stroke="#7f93b5" strokeWidth="0.8" opacity="0.8">
              <line x1="78" y1="56" x2="302" y2="56" /><line x1="78" y1="50" x2="78" y2="62" /><line x1="302" y1="50" x2="302" y2="62" />
              <line x1="58" y1="74" x2="58" y2="162" /><line x1="52" y1="74" x2="64" y2="74" /><line x1="52" y1="162" x2="64" y2="162" />
            </g>
            <text x="190" y="48" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="#9fb0cd" opacity="0.85">262 in</text>
            <text x="46" y="122" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="#9fb0cd" opacity="0.85" transform="rotate(-90 46 122)">58 in</text>
            <text x="80" y="188" fontFamily="Inter" fontSize="9" fill="#6f84a8" letterSpacing="1.5">SIGN TYPE: CHANNEL LETTERS</text>
          </svg>
          <div>
            <div className="ecsign-ph">Quoting &amp; order management</div>
            <div className="ecsign-pd">Create quotes, send proposals, and manage the pipeline.</div>
          </div>
        </div>

        <div className="ecsign-form">
          <div className="ecsign-inner">
            <img src="/quote-logo-t.png" alt="Epic Craftings" className="ecsign-logo" />
            <div className="ecsign-sub">Sign in to continue</div>

            <form onSubmit={handleSubmit}>
              <label className="ecsign-lbl">Email or username</label>
              <input className="ecsign-in" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="name@epiccraftings.com" autoCapitalize="none" autoCorrect="off" required autoFocus />

              <div className="ecsign-pwhead">
                <label className="ecsign-lbl">Password</label>
                <span className="ecsign-forgot" onClick={() => setInfo('Ask your administrator to reset your password.')}>Forgot password?</span>
              </div>
              <div className="ecsign-pwwrap">
                <input className="ecsign-in" type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
                <button type="button" className="ecsign-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.16 3.19M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
                </button>
              </div>

              {error && <div className="ecsign-err">{error}</div>}
              {info && <div className="ecsign-info">{info}</div>}

              <button type="submit" className="ecsign-btn" disabled={loading}>{loading ? 'Signing in…' : 'Log in'}</button>
            </form>

            <div className="ecsign-div"><span /><b>EPIC CRAFTINGS TEAM</b><span /></div>
            <div className="ecsign-foot">Need access? Contact your administrator.</div>
          </div>
        </div>

      </div>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.ecsign { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
  background:#070a12; font-family:'Inter',system-ui,sans-serif; color:#e8edf5; }
.ecsign-card { display:flex; width:100%; max-width:880px; min-height:480px; background:#0d1626; border:1px solid #1c2a44;
  border-radius:16px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.55); }

.ecsign-panel { flex:0 0 47%; position:relative; background:#0a1220; border-right:1px solid #1c2a44; padding:30px;
  display:flex; flex-direction:column; justify-content:space-between; }
.ecsign-tag { align-self:flex-start; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#f9a600;
  background:rgba(249,166,0,.1); border:1px solid rgba(249,166,0,.25); border-radius:999px; padding:5px 12px; }
.ecsign-bp { width:100%; height:auto; margin:14px 0; }
.ecsign-ph { font-size:19px; font-weight:700; color:#fff; margin-bottom:7px; }
.ecsign-pd { font-size:13.5px; line-height:1.55; color:#8497b6; }

.ecsign-form { flex:1; display:flex; align-items:center; justify-content:center; padding:32px; }
.ecsign-inner { width:300px; }
.ecsign-logo { height:30px; display:block; margin-bottom:8px; }
.ecsign-sub { font-size:13px; color:#7f93b5; margin-bottom:24px; }
.ecsign-lbl { display:block; font-size:12px; font-weight:600; color:#9fb0cd; margin-bottom:6px; }
.ecsign-in { width:100%; height:42px; background:#0a1220; border:1px solid #25364f; border-radius:8px; padding:0 12px;
  color:#e8edf5; font-size:14px; font-family:inherit; outline:none; transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
.ecsign-in::placeholder { color:#52688c; }
.ecsign-in:focus { border-color:#f9a600; box-shadow:0 0 0 3px rgba(249,166,0,.14); }
form .ecsign-in { margin-bottom:16px; }
.ecsign-pwhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; }
.ecsign-forgot { font-size:12px; color:#f9a600; font-weight:600; cursor:pointer; }
.ecsign-forgot:hover { color:#ffbe33; }
.ecsign-pwwrap { position:relative; }
.ecsign-pwwrap .ecsign-in { padding-right:42px; }
.ecsign-eye { position:absolute; right:6px; top:5px; height:32px; width:32px; background:none; border:none; cursor:pointer;
  color:#8497b6; line-height:1; display:flex; align-items:center; justify-content:center; opacity:.8; padding:0; }
.ecsign-eye:hover { opacity:1; }
.ecsign-err { font-size:13px; color:#fca5a5; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3);
  border-radius:7px; padding:8px 11px; margin-bottom:14px; }
.ecsign-info { font-size:12.5px; color:#9fb0cd; margin-bottom:14px; }
.ecsign-btn { width:100%; height:44px; background:#f9a600; color:#1a1305; border:none; border-radius:8px; font-weight:700;
  font-size:14px; font-family:inherit; cursor:pointer; box-shadow:0 6px 20px rgba(249,166,0,.25); transition:background .15s, transform .05s; }
.ecsign-btn:hover { background:#ffb21f; }
.ecsign-btn:active { transform:translateY(1px); }
.ecsign-btn:disabled { opacity:.6; cursor:not-allowed; }
.ecsign-div { display:flex; align-items:center; gap:12px; margin:22px 0 14px; }
.ecsign-div span { flex:1; height:1px; background:#1f2e47; }
.ecsign-div b { font-size:11px; color:#5b6e90; letter-spacing:.06em; font-weight:600; }
.ecsign-foot { text-align:center; font-size:12.5px; color:#6f84a8; }

@media (max-width:760px) {
  .ecsign-panel { display:none; }
  .ecsign-card { max-width:380px; min-height:0; }
}
`
