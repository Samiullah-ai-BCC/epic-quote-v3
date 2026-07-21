// Presentational "Select Sign Type" wizard step (AI mode). Two-level category picker,
// flat search, plus a free-typed custom type. All handlers come from Generator().
// The FA sign-type sheet (families → sign types → mounting/thickness) is the primary catalog
// now — its 7 families list first; the old SIGN_GROUP_ORDER categories still render after but
// most are now empty (their members superseded, marked legacy:1) and simply don't show; the
// two that still have live content are MONUMENT & PYLON SIGNS (free-form Template B) and the
// one CHANNEL LETTERS combo the FA sheet doesn't cover.
import { T, SIGN_GROUP_ORDER, signGroupOf } from '../../generator/catalog'
import { FA_FAMILY_ORDER, FA_SIGN_GROUPS } from '../../generator/faCatalog'
import { makeCustomTpl } from '../../generator/parts'

export default function SignTypeStep({
  signSearch, setSignSearch, signGroup, setSignGroup, tpl, pickSign,
  signLib, aiSuggestedName, customType, setCustomType, onUseTypedSignType,
}) {
  // FA families use the SAME signGroup state as the legacy categories — its value is just a
  // plain string, so an FA family name ("ILLUMINATED CHANNEL LETTERS") works identically to a
  // legacy category name ("CHANNEL LETTERS"); we just check which kind it is when rendering.
  const faFamily = FA_FAMILY_ORDER.includes(signGroup) ? signGroup : null
  const legacyGroup = signGroup && !faFamily ? signGroup : null

  return (
    <div className="step">
      <div className="step-head"><span className="step-icon">🏷️</span><h3>Select Sign Type</h3></div>
      <input placeholder="Search sign types…" value={signSearch} onChange={(e) => setSignSearch(e.target.value)} style={{ marginBottom: 12 }} />
      <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
        {signSearch.trim() || signGroup ? 'Click a sign type to continue.' : 'Pick a sign family first — searching skips straight to the types.'}
      </p>
      {/* two-level picker: families → the specific sign types inside the chosen one.
          Searching bypasses the grouping and filters ALL types (FA + legacy) flat. */}
      {!signSearch.trim() && !signGroup ? (
        <div className="sign-list">
          {tpl?.customType && (
            <div className="sign-opt sel" onClick={() => pickSign(tpl)}>{tpl.n}  ✏️ your custom type</div>
          )}
          {FA_FAMILY_ORDER.map((fam) => {
            const count = FA_SIGN_GROUPS.filter((g) => g.family === fam).length
            return (
              <div key={fam} className="sign-opt" onClick={() => setSignGroup(fam)} style={{ fontWeight: 700 }}>
                {fam} <span className="muted" style={{ fontWeight: 400 }}>· {count} type{count === 1 ? '' : 's'} →</span>
              </div>
            )
          })}
          {SIGN_GROUP_ORDER.map((g) => {
            const count = T.filter((t) => signGroupOf(t.n) === g && !t.legacy).length
            return count ? (
              <div key={g} className="sign-opt" onClick={() => setSignGroup(g)} style={{ fontWeight: 700 }}>
                {g} <span className="muted" style={{ fontWeight: 400 }}>· {count} type{count === 1 ? '' : 's'} →</span>
              </div>
            ) : null
          })}
          {signLib.length > 0 && (
            <div className="sign-opt" onClick={() => setSignGroup('__team__')} style={{ fontWeight: 700 }}>
              TEAM'S CUSTOM TYPES <span className="muted" style={{ fontWeight: 400 }}>· {signLib.length} types →</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {!signSearch.trim() && (
            <button className="ghost sm" style={{ marginBottom: 10 }} onClick={() => setSignGroup(null)}>← All categories</button>
          )}
          <div className="sign-list">
            {tpl?.customType && (
              <div className="sign-opt sel" onClick={() => pickSign(tpl)}>{tpl.n}  ✏️ your custom type</div>
            )}
            {/* FA sign types for the chosen family (or, when searching, matched flat) */}
            {FA_SIGN_GROUPS.filter((g) => (signSearch.trim()
                ? g.n.toLowerCase().includes(signSearch.toLowerCase())
                : g.family === faFamily)).map((g) => (
              <div
                key={g.n}
                className={'sign-opt' + (tpl?.n === g.n ? ' sel' : '') + (aiSuggestedName === g.n ? ' ai' : '')}
                onClick={() => pickSign(g)}
                title={g.hasThickness ? 'Thickness + mounting picked on the next step' : (g.leaves.length > 1 ? 'Mounting picked on the next step' : undefined)}
              >
                {g.n}{aiSuggestedName === g.n ? '  ⚡ AI suggested' : ''}
              </div>
            ))}
            {/* legacy / mono (monument, pylon, the one uncovered channel-letter combo, etc.) */}
            {T.filter((t) => !t.legacy && (signSearch.trim()
                ? t.n.toLowerCase().includes(signSearch.toLowerCase())
                : signGroupOf(t.n) === legacyGroup)).map((t) => (
              <div
                key={t.n}
                className={'sign-opt' + (tpl?.n === t.n ? ' sel' : '') + (aiSuggestedName === t.n ? ' ai' : '')}
                onClick={() => pickSign(t)}
              >
                {t.n}{aiSuggestedName === t.n ? '  ⚡ AI suggested' : ''}
              </div>
            ))}
            {signLib.filter((s) => (signSearch.trim()
                ? s.name.toLowerCase().includes(signSearch.toLowerCase())
                : signGroup === '__team__')).map((s) => (
              <div
                key={'lib' + s.id}
                className={'sign-opt' + (tpl?.n === s.name ? ' sel' : '')}
                onClick={() => pickSign(makeCustomTpl(s.name, s.data?.spec || null))}
              >
                {s.name}  ✏️ team custom type
              </div>
            ))}
          </div>
        </>
      )}
      <div className="field" style={{ marginTop: 14 }}>
        <label>Can't find it? Type the sign type yourself (it gets saved for the whole team)</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            placeholder="e.g. CHANNEL LETTERS WITH BACKER"
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && customType.trim()) onUseTypedSignType() }}
          />
          <button disabled={!customType.trim()} onClick={onUseTypedSignType}>Use this type →</button>
        </div>
      </div>
      <div className="foot">
        <span />{/* Back moved to the top-left bar (#4) */}
      </div>
    </div>
  )
}
