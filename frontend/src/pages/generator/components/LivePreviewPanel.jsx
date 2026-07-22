import Proposal from '../../../components/Proposal'

// The real, editable proposal shown beside every wizard step (not the final preview step,
// which already shows the full proposal). Remounted via a debounced `previewKey` so fresh
// wizard data always flows in, while typing inside the preview survives the remount (edits
// auto-save to proposal_state, which the remount restores dirty-first).
export default function LivePreviewPanel({
  previewKey, onBack, onSaveAndReturn, saving,
  mode, template, answers, customSpec, info, artworkPath, onArtworkFile, logo, aiResult,
  paymentLink, approval, proposalNotes, savedState, sideViews, signBox, onSideViews, onSave,
}) {
  return (
    <aside className="wiz-live">
      {/* wizard controls right above the (live) proposal on every step (#5) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="ghost sm" onClick={onBack}>← Back</button>
        <button className="ghost sm" onClick={onSaveAndReturn} disabled={saving}>{saving ? 'Saving…' : '💾 Save & Return'}</button>
      </div>
      <Proposal
        key={'live' + previewKey}
        mode={mode}
        tpl={template}
        answers={answers}
        customSpec={customSpec}
        info={info}
        artworkPath={artworkPath}
        onArtworkFile={onArtworkFile}
        logo={logo}
        aiResult={aiResult}
        paymentLink={paymentLink}
        approval={approval}
        proposalNotes={proposalNotes}
        savedState={savedState}
        sideViews={sideViews}
        signBox={signBox}
        onSideViews={onSideViews}
        onSave={onSave}
      />
    </aside>
  )
}
