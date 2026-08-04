import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

export default function LoginTwoFactorSetup({ setup, busy, error, onConfirm, onBack }) {
  const [code, setCode] = useState('')
  const [qr, setQr] = useState('')

  // Render locally: the TOTP secret must never be sent to a third-party QR service.
  useEffect(() => {
    let live = true
    QRCode.toDataURL(setup.otpauth_url, { width: 180, margin: 1 })
      .then((value) => { if (live) setQr(value) })
      .catch(() => { if (live) setQr('') })
    return () => { live = false }
  }, [setup.otpauth_url])

  const submit = (event) => {
    event.preventDefault()
    onConfirm(code.trim())
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-base font-bold text-side-ink mb-1">Secure your account</h2>
      <p className="text-[12px] text-side-dim mb-3">
        Two-factor authentication is required for every team member. Scan this before continuing.
      </p>

      <div className="flex gap-3 items-start mb-3">
        <div className="shrink-0 rounded-md bg-white p-1.5 w-[132px] h-[132px] grid place-items-center">
          {qr
            ? <img src={qr} alt="Two-factor setup QR code" className="w-[120px] h-[120px]" />
            : <span className="text-[10px] text-slate-600 text-center">Use the manual key</span>}
        </div>
        <div className="min-w-0 text-[11px] text-side-dim leading-relaxed">
          <div>Use Google Authenticator, Microsoft Authenticator, Authy, or 1Password.</div>
          <div className="mt-2">Manual key:</div>
          <code className="block mt-1 break-all text-[10px] text-side-ink bg-[#0a1220] border border-[#25364f] rounded px-2 py-1">
            {setup.secret}
          </code>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 mb-3">
        <div className="text-[11px] font-bold text-amber-200 mb-1">Save these recovery codes now</div>
        <div className="grid grid-cols-2 gap-x-3 font-mono text-[10px] text-amber-100">
          {setup.recovery_codes.map((recoveryCode) => <span key={recoveryCode}>{recoveryCode}</span>)}
        </div>
      </div>

      <Label className="text-xs font-semibold text-side-dim mb-1.5 block">Current 6-digit code</Label>
      <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric"
        autoComplete="one-time-code" autoFocus placeholder="000000"
        className="h-[44px] mb-2 tracking-[0.3em] text-center bg-[#0a1220] border-[#25364f] text-side-ink" />

      {error && <div className="text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 mb-3">{error}</div>}

      <Button type="submit" disabled={busy || !code.trim()}
        className="w-full h-11 bg-gold text-[#1a1305] font-bold hover:bg-gold-h">
        {busy ? 'Verifying…' : 'Verify and continue'}
      </Button>
      <button type="button" onClick={onBack}
        className="w-full mt-2 text-[12px] text-side-dim hover:text-side-ink bg-transparent border-0">
        ← Back to sign in
      </button>
    </form>
  )
}
