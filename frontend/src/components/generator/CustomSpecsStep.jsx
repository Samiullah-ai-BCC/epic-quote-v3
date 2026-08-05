// Presentational "Custom Specifications" wizard step (manual mode). The two-level type
// picker prefills the spec text; every field is controlled by Generator()'s hooks. The
// spec-sync helpers (setCustomDim / setCustomApplication / syncSpecFromFields) are passed
// in verbatim — this component owns no state.
import { useEffect, useRef } from 'react'
import { T, SIGN_GROUP_ORDER, signGroupOf } from '../../generator/catalog'
import { FA_FAMILY_ORDER, FA_SIGN_GROUPS, faMountingOptions, faThicknessOptions, faTrimCapOptions, faLeafExtras, itemDescriptionFor } from '../../generator/faCatalog'
import { buildSpecLines, normalizeSpecLines, MAX_SPEC_LINES } from '../../generator/proposal'
import { parseDims, composeDims } from '../../generator/questions'
import { pickSideView } from '../../generator/sideviews'
import { syncSpecFromFields, splitSpecialRequirements, mergeSpecial } from '../../generator/specSync'
import { saveCatalogItem } from '../../api/catalog'
import { MAX_PRICE } from '../../generator/parts'
import MoneyInput from '../MoneyInput'

export default function CustomSpecsStep({
  customSpec, setCustomSpec, customTypeSel, setCustomTypeSel,
  typePicking, setTypePicking, typeGroup, setTypeGroup,
  signLib, sideViews, setSideViews, client,
  customDimsStatus, setCustomDim, setCustomApplication, special, setSpecial, onSpecialLifted, ready,
  saveNext, saving, specCapacity,
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

  // Counted with the SAME function the proposal renders with, so the number under the box is what
  // the sheet will actually print — blank lines included, collapsed runs excluded.
  const specLineCount = normalizeSpecLines(customSpec?.specText).length
  // THE CAP IS MEASURED, NOT ASSUMED. `specCapacity` is what the live proposal beside this step
  // reports it can still print — empty room inside the SPECIFICATIONS box plus room left on the
  // page, in line heights. The old flat 14 was a worst-case guess that never moved, so a rep who
  // deleted ADDITIONAL NOTES to make room was still refused at 14 with a third of the sheet blank.
  // MAX_SPEC_LINES stays as the floor: never capped tighter than before, whatever is measured.
  const specMax = Math.max(MAX_SPEC_LINES, Number(specCapacity) || 0)
  const specFull = specLineCount >= specMax

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
            // '__new__' is a MODE, not a type name: it opens the name box below. There is nothing
            // in the catalog to resolve it against, and treating it as a name would blank the spec.
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
              // The sign type owns its application where the catalog states one (interior-only
              // types like the neon families say INTERIOR) — adopting it on the pick is the same
              // rule the side view and package follow, so switching type cannot leave the previous
              // type's EXTERIOR behind. Types whose spec carries an [APPLICATION] placeholder
              // (the FA/matrix families) define no value, so the rep's current answer stands.
              application: nextCat?.application || customSpec?.application || '',
              price: customSpec?.price || '',
              fa_mounting: mounting, fa_thickness: thickness, fa_trimcap: trimcap,
              // Template B (monument/pylon) carries neither a package nor a side view — custom
              // mode never sets tpl_name/tpl (see Proposal.jsx isMonoType), so this flag is the
              // only way that fact survives the pick to render time.
              mono: !!nextCat?.mono,
            })
          }
          // Committing a free-typed name: it IS the sign type, so it goes straight into the Sign
          // type field. No second box, no separate save button — asking for the same detail twice
          // on one form is what this step is being cleaned of.
          const commitTypedName = (raw) => {
            const NAME = String(raw || '').trim().toUpperCase()
            if (!NAME) return
            saveCatalogItem('sign_type', NAME, {}).catch(() => {})   // best-effort; never blocks
            setCustomSpec({
              ...customSpec,
              itemDesc: itemDescFor(NAME, ''),
              // SEEDED, NEVER OVERWRITTEN. Section 4 is the one place the specification is written;
              // naming a type must not discard text already typed there.
              specText: String(customSpec?.specText || '').trim() ? customSpec.specText : `SIGN TYPE: ${NAME}`,
            })
            setCustomTypeSel(NAME)
          }

          if (!typePicking) {
            // '__new__' turns THIS field into the input. The rep types the name where the type is
            // shown, which is the only place it was ever going to belong.
            const typing = customTypeSel === '__new__'
            return (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {typing ? (
                  <input
                    autoFocus
                    style={{ flex: 1 }}
                    placeholder="Type the sign type name, e.g. CHANNEL LETTERS WITH BACKER"
                    defaultValue=""
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTypedName(e.currentTarget.value) } }}
                    onBlur={(e) => commitTypedName(e.currentTarget.value)}
                  />
                ) : (
                  <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', background: 'var(--navy-900)' }}>
                    {customTypeSel || <span className="muted">— pick a sign type (prefills the spec) —</span>}
                  </div>
                )}
                <button type="button" className="ghost sm" onClick={() => { setTypePicking(true); setTypeGroup(null) }}>
                  {customTypeSel && !typing ? 'Change' : 'Pick a type'}
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
                  {/* TEAM'S CUSTOM TYPES is no longer offered here. `signLib` itself is still
                      loaded and still consulted when a type is picked (see `stored` above), so a
                      quote already saved against one of those names keeps resolving its stored
                      spec — only the browsing entry is gone, not the data. */}
                  <div className="sign-opt" onClick={() => pickCustomType('__new__')}>➕ Type a new custom sign type…</div>
                  <div className="sign-opt muted" onClick={() => { setTypePicking(false); setTypeGroup(null) }}>Cancel</div>
                </div>
              ) : (
                <>
                  <button type="button" className="ghost sm" style={{ marginBottom: 8 }} onClick={() => setTypeGroup(null)}>← Main sign types</button>
                  <div className="sign-list">
                    {FA_FAMILY_ORDER.includes(typeGroup)
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
        {/* No preselection: EXTERIOR used to be the default, so a rep who never looked at this
            field still shipped a proposal claiming EXTERIOR — including on interior-only signs.
            The blank option is the starting state and Next stays disabled until one is chosen. */}
        <select value={customSpec?.application || ''} onChange={(e) => setCustomApplication(e.target.value)}>
          <option value="">— Select application —</option>
          <option value="EXTERIOR">EXTERIOR</option><option value="INTERIOR">INTERIOR</option>
        </select>
      </div>
      <div className="step-section">4. Specification text</div>
      <div className="field">
        <label>Specification Text</label>
        {/* Blank lines now survive into the proposal, so the sheet's fixed height becomes a real
            limit the rep can hit by pressing Enter. The edit is refused only when it would GROW
            the spec past what the page can print — editing or deleting inside an already-long
            spec still works, so a legacy quote can never become uneditable. */}
        <textarea ref={specRef} rows={5} value={customSpec?.specText || ''}
          onChange={(e) => {
            const nextText = e.target.value
            const nextLines = normalizeSpecLines(nextText).length
            if (nextLines > specMax && nextLines > specLineCount) return
            setCustomSpec({ ...customSpec, specText: nextText })
          }} />
        <span className="muted" style={{ fontSize: 12, color: specFull ? 'var(--danger)' : undefined }}>
          {specFull
            ? `Specification is full — ${specLineCount} of ${specMax} lines. The sheet beside this step has no room left; remove a line here, or remove ADDITIONAL NOTES on the proposal to free more.`
            : `${specLineCount} of ${specMax} lines used. Blank lines count — they print on the proposal.`}
        </span>
      </div>
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
          // APPLICATION prints on the proposal's SPECIFICATIONS block, so it cannot go out blank —
          // and it no longer defaults to EXTERIOR, which is exactly why it now has to be answered.
          const noApp = !String(customSpec?.application || '').trim()
          const hint = noDims ? 'Enter all three dimensions — H × W × D (depth required)' : noApp ? 'Choose the application — INTERIOR or EXTERIOR' : overMax ? `Maximum quote price is $${MAX_PRICE.toLocaleString()}` : badPrice ? 'Enter a real price (more than $0) to continue' : ''
          return (
            <>
              {hint && <span style={{ color: 'var(--text-faint)', fontSize: 12, alignSelf: 'center' }}>{hint}</span>}
              <button disabled={badPrice || noDims || noApp} onClick={saveNext}>{saving ? 'Saving…' : 'Next →'}</button>
            </>
          )
        })()}
      </div>
    </div>
  )
}
