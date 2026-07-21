/* Left half of the sign-in card: the technical-blueprint illustration.
   Pure presentation — no props, no state. */
export default function BlueprintPanel() {
  return (
    <div className="relative shrink-0 basis-[47%] bg-[#0a1220] border-r border-[#1c2a44] p-10 flex flex-col justify-between max-[760px]:hidden">
      <span className="self-start text-[11px] font-bold tracking-widest uppercase text-gold bg-gold/10 border border-gold/25 rounded-full px-3 py-1">
        Estimator
      </span>
      <svg viewBox="0 0 360 230" className="w-full h-auto my-3.5" aria-hidden="true">
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
        <div className="text-[22px] font-bold text-white mb-1.5">Quoting &amp; order management</div>
        <div className="text-sm leading-relaxed text-[#8497b6]">Create quotes, send proposals, and manage the pipeline.</div>
      </div>
    </div>
  )
}
