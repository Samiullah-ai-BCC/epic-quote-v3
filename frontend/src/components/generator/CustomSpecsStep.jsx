// Presentational "Custom Specifications" wizard step (manual mode). The two-level type
// picker prefills the spec text; every field is controlled by Generator()'s hooks. The
// spec-sync helpers (setCustomDim / setCustomApplication / syncSpecFromFields) are passed
// in verbatim — this component owns no state.
import { useEffect, useRef } from 'react'
import { T, SIGN_GROUP_ORDER, signGroupOf } from '../../generator/catalog'
import { FA_FAMILY_ORDER, FA_SIGN_GROUPS, faMountingOptions, faThicknessOptions, faTrimCapOptions, faLeafExtras, itemDescriptionFor } from '../../generator/faCatalog'
import { buildSpecLines } from '../../generator/proposal'
import { parseDims, composeDims } from '../../generator/questions'
import { pickSideView } from '../../generator/sideviews'
import { syncSpecFromFields, splitSpecialRequirements, mergeSpecial } from '../../generator/specSync'
import { saveCatalogItem } from '../../api/catalog'
import { MAX_PRICE } from '../../generator/parts'
import MoneyInput from '../MoneyInput'

export default function CustomSpecsStep({
  customSpec, setCustomSpec, customTypeSel, setCustomTypeSel,
  typePicking, setTypePicking, typeGroup, setTypeGroup,
  signLib, setSignLib, sideViews, setSideViews, client,
  newTypeName, setNewTypeName, newTypeSpec, setNewTypeSpec,
  customDimsStatus, setCustomDim, setCustomApplication, special, setSpecial, onSpecialLifted, ready,
  saveNext, saving,
}) {
  // FA sign types (family/mounting-driven) prefill from a resolved leaf's spec — the rep
  // free-edits from there (this flow is a one-time prefill, not the live wizard). FA checked
  // FIRST: several FA sign types share their exact name with the legacy T[] entry they
  // supersede (kept only so an old saved quote still resolves) — the picker only ever offers
  // the CURRENT one, so a name match must resolve to that, not the hidden legacy entry.
  const specRef = useRef(null)
  const cat = FA_SIGN_GROUPS.find((g) => g.n === customTypeSel) || T.find((t) => t.n === customTypeSel)
  const trimOpts = cat?.fa && cat.hasTrimCap ? faTrimCapOptions(cat) : []
  const thickOpts = cat?.fa && cat.hasThickness ? faThicknessOptions(cat) : []
  const mountOpts = cat?.fa ? faMountingOptions(cat, customSpec?.fa_thickness, customSpec?.fa_trimcap) : []

  // DEPTH IS NOT THE REP'S TO TYPE WHEN THE SHEET ALREADY STATES IT. For the sign types whose
  // standard data carries a `thickness` (the flat-cut families), that thickness IS the third
  // dimension, and the leaf's own spec line ("LETTERS THICKNESS: 1/4\"") is the source of truth.
  // The D box is therefore locked to it and shows it verbatim.
  //
  // It is shown, never stored: thicknesses are FRACTIONS (1/8" 1/4" 3/8" 1/2" 3/4" 1"), and
  // customSpec.dims runs every value through cleanNum(), which keeps only digits and dots — it
  // would silently turn 1/4" into 14 and print "OVERALL DIMENSIONS: 44\" x 18\" x 14\"" on a
  // customer's proposal. composeDims() drops empty parts, so leaving D out yields the correct
  // "H x W" for these types, with the thickness stated on its own line.
  const depthFromSheet = (cat?.fa && cat.hasThickness)
    ? (customSpec?.fa_thickness || faThicknessOptions(cat)[0] || '')
    : ''

  // Item Description format: "{Sign Type} WITH {Mounting} FOR {Company}" — the mounting is part
  // of what the customer is buying, so it belongs in the line-item text. Types without a
  // mounting (non-FA / free-typed) fall back to "{Sign Type} FOR {Company}".
  // Delegates to the single definition in faCatalog so the proposal, this step and any future
  // caller cannot drift apart. See SYSTEM_MAP -> ITEM DESCRIPTION.
  const itemDescFor = (base, mounting) => itemDescriptionFor(base, mounting, client.company_name)

  // ── SIDE VIEW: one rule, shared by every path that can change the diagram ──────────────
  // The construction diagram is a property of the exact leaf (sign type × trim cap × thickness ×
  // mounting), so ANY of those changing must re-derive it. Changing the MOUNTING already did;
  // changing the SIGN TYPE only ever set a diagram when there was none, so switching type left
  // the previous type's drawing on the proposal. Same rule, both paths — and any future path.
  const autoSideViewFor = (c, answers) => {
    if (!c) return ''
    return c.fa ? (faLeafExtras(c, answers).sideview || '') : (pickSideView(c.n)?.selected || '')
  }
  // MAY WE REPLACE THE DIAGRAM ON SCREEN? The diagram is a property of the resolved LEAF, so a
  // CATALOG diagram always belongs to whatever leaf was selected when it was assigned — once the
  // sign type, trim cap, thickness or mounting changes, it describes a different product and must
  // be re-derived. That is the domain rule, and it needs no knowledge of the previous selection.
  //
  // The earlier version asked "does this match what I derived for the PREVIOUS config?", which
  // only works while the stored type and the stored diagram agree. They drift — a quote saved with
  // one type and later re-typed keeps the old key — and then the app read its own stale auto-pick
  // as a deliberate human choice and refused to touch it. That is exactly the reported bug.
  //
  // Only things that are NOT catalog-derived survive a change:
  //   • an uploaded image (/storage or https) — the rep's own artwork, not a leaf property
  //   • an explicit '__none__' — they removed the side view on purpose
  //   • several diagrams picked together — a deliberate composition
  // TRADE-OFF, stated: a rep who hand-picks a DIFFERENT catalog diagram for the same leaf will
  // see it re-derived when they next change the type or mounting. That is the intended behaviour
  // here ("the side view must follow the sign type"); uploading the drawing is the way to pin one.
  const sideViewReplaceable = () => {
    if (sideViews.length === 0) return true
    if (sideViews.length > 1) return false
    const only = sideViews[0]
    if (only === '__none__') return false
    if (/^(https?:|\/storage)/i.test(String(only))) return false
    return true
  }

  // Rebuild the spec text for the CURRENT type + the given mounting/thickness (auto-picks the
  // first option of each when not yet chosen — #7 "thickness/mounting not being asked/picked").
  const applyFaConfig = (mounting, thickness, trimcap) => {
    // Feed the dimensions the rep ALREADY typed into the template as well, so [HEIGHT]/[WIDTH]/
    // [DEPTH] resolve at the source instead of being patched back in afterwards. The 3rd dimension
    // IS the return depth — that is the only place this flow collects it (the live wizard's
    // fa_depth question does not exist here), so without it the template kept its [DEPTH] token.
    const d = parseDims(customSpec?.dims)
    // When the sheet states the thickness, it OWNS the third dimension. A depth left over in
    // customSpec.dims from an earlier type would otherwise keep winning: syncSpecFromFields
    // rewrites "LETTERS THICKNESS:" from dims.h, so a stale h=2 printed `LETTERS THICKNESS: 2"`
    // and `OVERALL DIMENSIONS: 44" x 18" x 2"` over the sheet's own 1/2". Dropping h makes
    // composeDims emit the correct `44" x 18"` and leaves the template's thickness line intact.
    const sheetThickness = (cat?.fa && cat.hasThickness) ? (thickness || faThicknessOptions(cat)[0] || '') : ''
    const dims = sheetThickness ? composeDims(d.l, d.w, '') : (customSpec?.dims || '')
    const answers = {
      fa_mounting: mounting, fa_thickness: thickness, fa_trimcap: trimcap,
      dim_l: d.l, dim_w: d.w, fa_depth: sheetThickness ? '' : d.h,
    }
    const specText = syncSpecFromFields(buildSpecLines(cat, answers, null).join('\n'), { ...customSpec, dims })
    // The construction diagram is a property of the exact leaf, not of the sign type: trim cap
    // and mounting each change what the side view must show. Follow the leaf unless the rep
    // has hand-picked something else (then their choice stands).
    // A SUPERSEDED key counts as "not hand-picked": quotes made before the catalog was
    // recalibrated carry one of the 27 old keys, which the app chose from the sign-type NAME
    // alone — nobody decided it, so keeping it only shows the rep an outdated drawing.
    const nextKey = autoSideViewFor(cat, answers)
    if (nextKey && sideViewReplaceable()) setSideViews([nextKey])
    // Keep the Item Description's mounting in step with the dropdown — but NEVER overwrite a
    // description the rep hand-edited: only regenerate when the current text still exactly
    // matches what the auto-format produced for the previous mounting.
    const autoBefore = itemDescFor(cat?.desc || customTypeSel, customSpec?.fa_mounting)
    const itemDesc = (!customSpec?.itemDesc || customSpec.itemDesc === autoBefore)
      ? itemDescFor(cat?.desc || customTypeSel, mounting)
      : customSpec.itemDesc
    // Lift the template's trailing bullet into Special Requirements — but NEVER over the rep's
    // own words: only when the box is empty or still holds exactly what the PREVIOUS template
    // put there. Same rule the item description uses. The bullet stays in the spec text as well,
    // because that is where it prints today and nobody asked for it to stop printing.
    setCustomSpec({ ...customSpec, dims, fa_mounting: mounting, fa_thickness: thickness, fa_trimcap: trimcap, specText, itemDesc })
  }

  // MOVE the template's trailing bullet out of the spec and into Special Requirements.
  // Runs from a single effect below rather than only when the sign type / mounting changes —
  // an already-open quote never changes either, which is why the line just sat there.
  const liftingRef = useRef(false)
  useEffect(() => {
    // WAIT FOR THE QUOTE TO FINISH LOADING. Spec text and the saved special_requirements arrive
    // from separate parts of the load; lifting before both are in raced the server's value.
    if (ready === false || liftingRef.current) return
    const text = customSpec?.specText || ''
    if (!text) return
    // Never re-flow the box the rep is typing in: cutting a line under a live caret would move
    // it mid-keystroke. The cut happens as soon as they click away.
    if (specRef.current && document.activeElement === specRef.current) return

    const { spec, special: lifted } = splitSpecialRequirements(text)
    // Scaffolding tokens must never reach a customer document. Newly built specs already
    // suppress them, but a quote SAVED earlier still carries them and nothing cleared it on
    // open. Strip EVERY bracketed token, not just the reported two — [APPLICATION] is the
    // same defect wearing a different name.
    const cleaned = spec.replace(/\[[A-Z][A-Z ]*\]["”]?/g, '').replace(/[ 	]+$/gm, '')
    if (!lifted && cleaned === text) return

    // ORDER MATTERS, AND IT IS THE WHOLE POINT. The spec text autosaves on change, so cutting
    // the line and only THEN saving the requirement left a window where the text lived in
    // neither place — reopening the quote showed a requirement that had silently vanished.
    // Persist the requirement FIRST, await it, and cut only once it is safely stored.
    liftingRef.current = true
    const cut = () => { if (cleaned !== text) setCustomSpec({ ...customSpec, specText: cleaned }); liftingRef.current = false }
    const nextSpecial = mergeSpecial(special, lifted)
    if (lifted && nextSpecial !== (special || '') && onSpecialLifted) {
      Promise.resolve(onSpecialLifted(nextSpecial))
        .then(cut)
        .catch(() => { liftingRef.current = false })   // save failed -> leave the spec intact
    } else {
      if (lifted && nextSpecial !== (special || '')) setSpecial(nextSpecial)
      cut()
    }
  }, [ready, customSpec?.specText, special]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="step">
      <div className="step-accent" />
      <div className="step-head">
        <span className="step-icon">📋</span>
        <h3>Custom Specifications</h3>
      </div>
      <div className="step-section">1. Sign basics</div>
      <div className="field">
        <label>Sign type</label>
        {/* Two-level, fully reversible picker (#2): main sign types first, then the
            underlying types; "← Main sign types" walks back up at any point. */}
        {(() => {
          const pickCustomType = (v) => {
            setCustomTypeSel(v)
            setTypePicking(false); setTypeGroup(null)
            if (v === '' || v === '__new__') return
            const nextCat = FA_SIGN_GROUPS.find((g) => g.n === v) || T.find((t) => t.n === v)
            const stored = signLib.find((s) => s.name === v)
            // FA types: auto-pick the first thickness/mounting so the spec is never left with
            // unfilled placeholders the rep never got asked to choose.
            const trimcap = nextCat?.hasTrimCap ? faTrimCapOptions(nextCat)[0] : undefined
            const thickness = nextCat?.hasThickness ? faThicknessOptions(nextCat)[0] : undefined
            const mounting = nextCat?.fa ? faMountingOptions(nextCat, thickness, trimcap)[0] : undefined
            // the template inherits whatever dims/depth/application are already typed —
            // the boxes are the source of truth (fixes RETURNS not matching the D box)
            // Same rule as applyFaConfig: a thickness-driven type owns the third dimension, so a
            // depth carried over from the previous type is dropped rather than left to overwrite
            // the sheet's own thickness line.
            const pd = parseDims(customSpec?.dims)
            const nextDims = (nextCat?.fa && nextCat.hasThickness) ? composeDims(pd.l, pd.w, '') : (customSpec?.dims || '')
            const specText = syncSpecFromFields(
              nextCat ? buildSpecLines(nextCat, { fa_mounting: mounting, fa_thickness: thickness, fa_trimcap: trimcap }, null).join('\n') : (stored?.data?.spec || `SIGN TYPE: ${v}`),
              { ...customSpec, dims: nextDims }
            )
            // The sign type implies its construction diagram, so switching type must re-derive it
            // — not merely fill it in when empty, which left the OLD type's drawing in place.
            // `prevAuto` is what the app derived for the type being replaced; if that is what is
            // on screen, it was never the rep's choice and may be updated.
            if (nextCat) {
              const sv = autoSideViewFor(nextCat, { fa_mounting: mounting, fa_thickness: thickness, fa_trimcap: trimcap })
              if (sv && sideViewReplaceable()) setSideViews([sv])
            }
            setCustomSpec({
              ...customSpec,
              dims: nextDims,
              // PERSIST THE PICKED TYPE. `customTypeSel` is component state and was never saved,
              // so reopening a quote lost it — see resolveSignTypeName().
              signType: v,
              itemDesc: itemDescFor(nextCat?.desc || v, mounting),
              specText,
              application: customSpec?.application || 'EXTERIOR',
              price: customSpec?.price || '',
              fa_mounting: mounting, fa_thickness: thickness, fa_trimcap: trimcap,
              // Template B (monument/pylon) carries neither a package nor a side view — custom
              // mode never sets tpl_name/tpl (see Proposal.jsx isMonoType), so this flag is the
              // only way that fact survives the pick to render time.
              mono: !!nextCat?.mono,
            })
          }
          if (!typePicking) {
            return (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', background: 'var(--navy-900)' }}>
                  {customTypeSel && customTypeSel !== '__new__' ? customTypeSel : <span className="muted">— pick a sign type (prefills the spec) —</span>}
                </div>
                <button type="button" className="ghost sm" onClick={() => { setTypePicking(true); setTypeGroup(null) }}>
                  {customTypeSel ? 'Change' : 'Pick a type'}
                </button>
              </div>
            )
          }
          return (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 10 }}>
              {typeGroup == null ? (
                <div className="sign-list">
                  {FA_FAMILY_ORDER.map((fam) => {
                    const c = FA_SIGN_GROUPS.filter((g) => g.family === fam).length
                    return (
                      <div key={fam} className="sign-opt" style={{ fontWeight: 700 }} onClick={() => setTypeGroup(fam)}>
                        {fam} <span className="muted" style={{ fontWeight: 400 }}>· {c} types →</span>
                      </div>
                    )
                  })}
                  {/* 'CHANNEL LETTERS' is hidden on THIS picker only: its one non-legacy entry is
                      superseded by the FA families above (ILLUMINATED / NON ILLUMINATED FABRICATED
                      CHANNEL LETTERS), so offering it here just duplicates them. Filtered locally
                      rather than removed from SIGN_GROUP_ORDER, which the AI-mode SignTypeStep
                      picker also reads — and `T` is untouched, so saved quotes on that legacy type
                      still resolve by name. */}
                  {SIGN_GROUP_ORDER.filter((g) => g !== 'CHANNEL LETTERS').map((g) => {
                    const c = T.filter((t) => signGroupOf(t.n) === g && !t.legacy).length
                    return c ? (
                      <div key={g} className="sign-opt" style={{ fontWeight: 700 }} onClick={() => setTypeGroup(g)}>
                        {g} <span className="muted" style={{ fontWeight: 400 }}>· {c} types →</span>
                      </div>
                    ) : null
                  })}
                  {signLib.length > 0 && (
                    <div className="sign-opt" style={{ fontWeight: 700 }} onClick={() => setTypeGroup('__team__')}>
                      TEAM'S CUSTOM TYPES <span className="muted" style={{ fontWeight: 400 }}>· {signLib.length} →</span>
                    </div>
                  )}
                  <div className="sign-opt" onClick={() => pickCustomType('__new__')}>➕ Type a new custom sign type…</div>  {/* Chqanged the  text "➕ Type a new sign type" to "➕ Type a new custom sign type" */}
                  <div className="sign-opt muted" onClick={() => { setTypePicking(false); setTypeGroup(null) }}>Cancel</div>
                </div>
              ) : (
                <>
                  <button type="button" className="ghost sm" style={{ marginBottom: 8 }} onClick={() => setTypeGroup(null)}>← Main sign types</button>
                  <div className="sign-list">
                    {typeGroup === '__team__'
                      ? signLib.map((s) => (
                          <div key={'lib' + s.id} className={'sign-opt' + (customTypeSel === s.name ? ' sel' : '')} onClick={() => pickCustomType(s.name)}>{s.name} ✏️</div>
                        ))
                      : FA_FAMILY_ORDER.includes(typeGroup)
                      ? FA_SIGN_GROUPS.filter((g) => g.family === typeGroup).map((g) => (
                          <div key={g.n} className={'sign-opt' + (customTypeSel === g.n ? ' sel' : '')} onClick={() => pickCustomType(g.n)}>{g.n}</div>
                        ))
                      : T.filter((t) => signGroupOf(t.n) === typeGroup && !t.legacy).map((t) => (
                          <div key={t.n} className={'sign-opt' + (customTypeSel === t.n ? ' sel' : '')} onClick={() => pickCustomType(t.n)}>{t.n}</div>
                        ))}
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </div>
      {/* Trim cap → thickness → mounting: each narrows the next, so changing an outer one
          re-picks the first still-valid inner option rather than leaving a combination the
          sheet doesn't define. */}
      {cat?.fa && (trimOpts.length > 0 || thickOpts.length > 0 || mountOpts.length > 1) && (
        <div className="grid2">
          {trimOpts.length > 0 && (
            <div className="field">
              <label>Trim cap</label>
              <select value={customSpec?.fa_trimcap || trimOpts[0]} onChange={(e) => {
                const nextMount = faMountingOptions(cat, customSpec?.fa_thickness, e.target.value)[0]
                applyFaConfig(nextMount, customSpec?.fa_thickness, e.target.value)
              }}>
                {trimOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {thickOpts.length > 0 && (
            <div className="field">
              <label>Thickness</label>
              <select value={customSpec?.fa_thickness || thickOpts[0]} onChange={(e) => {
                const nextMount = faMountingOptions(cat, e.target.value, customSpec?.fa_trimcap)[0]
                applyFaConfig(nextMount, e.target.value, customSpec?.fa_trimcap)
              }}>
                {thickOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {mountOpts.length > 1 && (
            <div className="field">
              <label>Mounting</label>
              <select value={customSpec?.fa_mounting || mountOpts[0]} onChange={(e) => applyFaConfig(e.target.value, customSpec?.fa_thickness, customSpec?.fa_trimcap)}>
                {mountOpts.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      {customTypeSel === '__new__' && (
        <div className="field" style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12 }}>
          <label>New sign type name</label>
          <input placeholder="e.g. CHANNEL LETTERS WITH BACKER" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
          <label style={{ marginTop: 10 }}>Its spec template (optional — paste one from a past quote; it gets saved for the whole team, in both modes)</label>
          <textarea rows={5} value={newTypeSpec} onChange={(e) => setNewTypeSpec(e.target.value)} placeholder={'SIGN TYPE: …\nFACE: …\nRETURNS: …'} />
          <button className="ghost sm" style={{ marginTop: 8 }} disabled={!newTypeName.trim()} onClick={async () => {
            const NAME = newTypeName.trim().toUpperCase()
            const spec = newTypeSpec.trim() || `SIGN TYPE: ${NAME}`
            try { const item = await saveCatalogItem('sign_type', NAME, { spec }); setSignLib((l) => [...l.filter((x) => x.name !== NAME), item]) } catch { /* still usable locally */ }
            setCustomSpec({ ...customSpec, itemDesc: `${NAME} FOR ${client.company_name || 'CUSTOMER'}`, specText: spec, application: customSpec?.application || 'EXTERIOR', price: customSpec?.price || '' })
            setCustomTypeSel(NAME)
            setNewTypeName(''); setNewTypeSpec('')
          }}>Save & use this type</button>
        </div>
      )}
      <div className="field"><label>Item Description</label><input value={customSpec?.itemDesc || ''} onChange={(e) => setCustomSpec({ ...customSpec, itemDesc: e.target.value })} /></div>
      <div className="step-section">2. Dimensions &amp; pricing</div>
      <div className="field">
        <label>Overall dimensions (H × W × D){customDimsStatus ? `  ${customDimsStatus}` : ''}</label>
        <div className="dims-row">
          {['l', 'w', 'h'].map((part, i) => (
            <div className="dims-cell" key={part}>
              {part === 'h' && depthFromSheet ? (
                <input type="text" readOnly value={depthFromSheet} tabIndex={-1}
                  title={'Thickness comes from the standard data for this sign type (' + depthFromSheet + ') — it is not editable here.'}
                  style={{ background: 'var(--navy-800, #f1f3f7)', cursor: 'default', color: 'var(--text-dim, #5a6577)' }} />
              ) : (
                <input type="text" inputMode="decimal" placeholder={['H', 'W', 'D'][i]}
                  value={parseDims(customSpec?.dims)[part] || ''}
                  onChange={(e) => setCustomDim(part, e.target.value)} />
              )}
              {i < 2 && <span className="dims-x">×</span>}
            </div>
          ))}
          <span className="dims-unit">in</span>
        </div>
      </div>
      {/* price / qty / total share one row (#3) — total is read-only, derived from the other two */}
      <div className="grid3">
        <div className="field"><label>Price per unit (USD)</label><MoneyInput value={customSpec?.price || ''} onChange={(v) => setCustomSpec({ ...customSpec, price: v })} placeholder="e.g. 2500" /></div>
        <div className="field">
          <label>Quantity</label>
          <input type="number" min="1" step="1" value={customSpec?.qty ?? 1}
            onChange={(e) => { const n = parseInt(e.target.value, 10); setCustomSpec({ ...customSpec, qty: Number.isFinite(n) && n > 0 ? n : 1 }) }} />
        </div>
        <div className="field">
          <label>Total</label>
          <input disabled value={(() => { const t = (Number(customSpec?.price) || 0) * (parseInt(customSpec?.qty, 10) > 0 ? parseInt(customSpec?.qty, 10) : 1); return t > 0 ? '$' + t.toLocaleString() : '—' })()} />
        </div>
      </div>
      <div className="step-section">3. Application</div>
      <div className="field">
        <label>Application</label>
        <select value={customSpec?.application || 'EXTERIOR'} onChange={(e) => setCustomApplication(e.target.value)}>
          <option value="EXTERIOR">EXTERIOR</option><option value="INTERIOR">INTERIOR</option>
        </select>
      </div>
      <div className="step-section">4. Specification text</div>
      <div className="field"><label>Specification Text</label><textarea ref={specRef} rows={5} value={customSpec?.specText || ''} onChange={(e) => setCustomSpec({ ...customSpec, specText: e.target.value })} /></div>
      <div className="step-section">5. Special requirements</div>
      <div className="field">
        <label>Special requirements (anything unusual about this job)</label>
        <textarea rows={1} value={special} onChange={(e) => setSpecial(e.target.value)} placeholder="e.g. rush order, special finish, permits…" />
      </div>
      <div className="foot">
        <span />{/* Back moved to the top-left bar (#4) */}
        {(() => {
          const n = Number(customSpec?.price)
          const overMax = Number.isFinite(n) && n > MAX_PRICE
          const badPrice = String(customSpec?.price ?? '').trim() === '' || !Number.isFinite(n) || n <= 0 || overMax
          // depth (D) is mandatory now, same as H and W — the overall dimensions must be complete
          // Depth is not required when the sheet supplies it as a thickness — otherwise Next
          // would be permanently disabled on a field that is deliberately read-only.
          const dp = parseDims(customSpec?.dims); const noDims = !dp.l || !dp.w || (!dp.h && !depthFromSheet)
          const hint = noDims ? 'Enter all three dimensions — H × W × D (depth required)' : overMax ? `Maximum quote price is $${MAX_PRICE.toLocaleString()}` : badPrice ? 'Enter a real price (more than $0) to continue' : ''
          return (
            <>
              {hint && <span style={{ color: 'var(--text-faint)', fontSize: 12, alignSelf: 'center' }}>{hint}</span>}
              <button disabled={badPrice || noDims} onClick={saveNext}>{saving ? 'Saving…' : 'Next →'}</button>
            </>
          )
        })()}
      </div>
    </div>
  )
}
