import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import client from '../../api/client'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

/* Two-factor setup for YOUR OWN account.

   Enrolment is deliberately two-step: scanning a QR only stores a secret, and 2FA does not
   actually guard the account until a first code has been verified here. That gap is what stops
   a mis-scanned QR or a phone with a wrong clock from turning into a locked-out rep.

   The secret and recovery codes are shown exactly once, at enrolment — they are encrypted at
   rest and the API never serves them again. */

export default function TwoFactorPanel() {
  const [status, setStatus] = useState(null)      // {enabled, pending, recovery_codes_remaining}
  const [setup, setSetup] = useState(null)        // {secret, otpauth_url, recovery_codes}
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = async () => {
    try { setStatus((await client.get('/two-factor')).data) } catch { /* panel just stays blank */ }
  }
  useEffect(() => { load() }, [])

  // Render the otpauth URI locally — the secret must never travel to a third-party QR service.
  useEffect(() => {
    if (!setup?.otpauth_url) { setQr(''); return }
    QRCode.toDataURL(setup.otpauth_url, { width: 190, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''))   // manual-entry secret below is the fallback
  }, [setup])

  const begin = async () => {
    setError(''); setBusy(true)
    try { setSetup((await client.post('/two-factor/enable')).data) }
    catch (e) { setError(e.response?.data?.message || 'Could not start setup.') }
    finally { setBusy(false) }
  }

  const confirm = async () => {
    setError(''); setBusy(true)
    try {
      await client.post('/two-factor/confirm', { code: code.trim() })
      setDone('Two-factor authentication is on. You will be asked for a code at your next sign-in.')
      setSetup(null); setCode('')
      await load()
    } catch (e) {
      setError(e.response?.data?.message || 'That code is not valid.')
    } finally { setBusy(false) }
  }

  if (!status) return null

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-sm font-bold">Two-factor authentication</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A code from your phone, on top of your password.
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${
          status.enabled
            ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
            : 'text-amber-700 border-amber-300 bg-amber-50'}`}>
          {status.enabled ? 'Required · On' : 'Setup required'}
        </span>
      </div>

      {error && <div className="mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {done && <div className="mt-3 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{done}</div>}

      {/* ---- enrolled ---- */}
      {status.enabled && !setup && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">
            {status.recovery_codes_remaining} recovery code{status.recovery_codes_remaining === 1 ? '' : 's'} left.
          </p>
          <p className="text-xs text-muted-foreground">
            Two-factor authentication is required by organization policy. If you lose your phone and recovery codes, ask an administrator to reset it.
          </p>
        </div>
      )}

      {/* ---- not enrolled ---- */}
      {!status.enabled && !setup && (
        <Button className="mt-4" disabled={busy} onClick={begin}>
          {busy ? 'Starting…' : 'Set up two-factor'}
        </Button>
      )}

      {/* ---- mid-enrolment ---- */}
      {setup && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] items-start">
          <div className="rounded-lg border border-border bg-white p-2 w-fit">
            {qr
              ? <img src={qr} alt="Two-factor QR code" width={190} height={190} />
              : <div className="w-[190px] h-[190px] grid place-items-center text-xs text-muted-foreground text-center px-3">
                  Enter the key below manually
                </div>}
          </div>

          <div className="min-w-0">
            <ol className="text-[13px] leading-relaxed list-decimal ml-4 space-y-1">
              <li>Scan this with Google Authenticator, Authy, or 1Password.</li>
              <li>Or enter the key by hand:
                <code className="block mt-1 text-[11px] break-all bg-muted rounded px-2 py-1">{setup.secret}</code>
              </li>
              <li>Enter the current 6-digit code to finish.</li>
            </ol>

            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="text-xs font-bold text-amber-900 mb-1">Save these recovery codes now</div>
              <p className="text-[11px] text-amber-800 mb-2">
                They are shown once and are the only way in if you lose your phone. Each works a single time.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] text-amber-900">
                {setup.recovery_codes.map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
                placeholder="6-digit code" className="max-w-[160px] tracking-widest" />
              <Button disabled={busy || !code.trim()} onClick={confirm}>{busy ? 'Verifying…' : 'Verify & enable'}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setSetup(null); setCode(''); setError('') }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
