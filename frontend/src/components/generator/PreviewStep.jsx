// Presentational final "Proposal" wizard step: the stacked, per-part proposal pages plus
// the Done / Add-page / Undo-delete toolbar. Every callback (savePart, addPage, deletePage,
// the capture collectors, savePaymentLink…) is defined in Generator() and passed in — this
// component threads them into each <Proposal> without owning any state.
import { partLetter } from '../../generator/parts'
import Proposal from '../Proposal'

export default function PreviewStep({
  parts, cpBusy, cpMsg, saving, saveCheckpoint, navigate, exitTo, addPage,
  setExitAsk, deletedPage, undoDeletePage, deleteTimer, setDeletedPage,
  multiPreviewRef, grandTotal, tplForPart, client, quoteId,
  collectPartImages, linkTitle, captureAllPages, capturePagesExport,
  canCreatePaymentLinks, savePaymentLink, logo, paymentLink, quote,
  savePart, commitPartArtworkFile, movePart, pageRefs, proposalRef, mode, editPart, deletePage,
}) {
  return (
    <div className="step">
      {/* the wizard controls live right above the proposal (#2). "Done" saves a version
          (rev) with the rendered image (#4); Back asks save-or-delete (#3). "+ Add sign page"
          appends another sign to this quote (top-right of the preview canvas). */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, marginRight: 6 }}>Proposal{parts.length > 1 ? ` — ${parts.length} signs` : ''}</h3>
        <button className="ghost sm" onClick={() => setExitAsk(true)}>← Back</button>
        {/* Only ONE "Edit specs" entry point (#12): the per-page button below, top-right of
            each proposal page — it knows exactly which sign it's editing (editPart(i)). This
            toolbar used to have a second one that stepped back a flow index without saying
            which part it affected — confusing on a multi-sign quote and pure duplication on a
            single-sign one. */}
        {/* ONE finish button: Done = save everything, mint the version (rev + image), leave */}
        <button className="sm" disabled={!!cpBusy || saving}
          title="Save everything, record this version (rev with the rendered proposal image) and return"
          onClick={async () => { await saveCheckpoint(); navigate(exitTo) }}>
          {cpBusy ? 'Saving version…' : '✓ Done'}
        </button>
        <button className="ghost sm" style={{ marginLeft: 'auto' }} disabled={saving}
          title="Add another sign to this quote — one client, one combined total"
          onClick={addPage}>＋ Add sign page</button>
        {cpMsg && <span className="muted" style={{ fontSize: 12.5 }}>{cpMsg}</span>}
      </div>

      {deletedPage && (
        <div style={{ display: 'flex', margintop:40, alignItems: 'center', gap: 0, marginBottom: 12, padding: '9px 14px', background: 'var(--gold-soft)', border: '1px solid var(--gold)', borderRadius: 8, fontSize: 13 }}>
          <span>Page deleted.</span>
          <button className="ghost sm" onClick={undoDeletePage}>↶ Undo delete</button>
          <button className="ghost sm" style={{ marginLeft: 'auto' }} onClick={() => { clearTimeout(deleteTimer.current); setDeletedPage(null) }}>Dismiss</button>
        </div>
      )}

      {/* one full proposal PAGE per sign part, stacked. Each page edits ITSELF (savePart);
          only the LAST page carries the combined total, downloads and payment. */}
      <div ref={multiPreviewRef} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {parts.map((p, i) => {
          const isLast = i === parts.length - 1
          const multi = parts.length > 1
          // key includes letter + last-ness so a page REMOUNTS when those change (add/delete/
          // reorder) — its write-once proposal ID + price columns are recomputed correctly.
          const pageKey = `${p.__pid}|${multi ? partLetter(i) : 's'}|${isLast ? 'L' : '_'}`
          // Per-page actions render INSIDE the page's own controls column (Proposal pageActions):
          // as a flow row above the page they pushed the whole sheet down (the dead white band).
          // Living in the column they stay glued to THEIR page — after a reorder each row still
          // edits/moves/deletes the sign it sits beside, because everything closes over `i` of
          // the freshly-mapped render.
          const pageActions = (
            <>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ghost sm" style={{ flex: 1 }} onClick={() => editPart(i)} disabled={saving}
                  title={`Edit the sign type & specifications of page ${multi ? partLetter(i) : ''}`.trim()}>
                  ✎ Edit specs{multi ? ' ' + partLetter(i) : ''}
                </button>
                {multi && (
                  <button className="ghost sm" onClick={() => deletePage(i)} disabled={saving}
                    title={`Delete sign page ${partLetter(i)}`}
                    style={{ color: '#e05661', borderColor: '#e05661' }}>
                    🗑 {partLetter(i)}
                  </button>
                )}
              </div>
              {multi && movePart && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ghost sm" style={{ flex: 1 }} disabled={saving || i === 0}
                    title={`Move page ${partLetter(i)} up — it becomes page ${i > 0 ? partLetter(i - 1) : partLetter(i)} and every letter, proposal ID and the last-page total re-sequence automatically`}
                    onClick={() => movePart(i, -1)}>↑ Move up</button>
                  <button className="ghost sm" style={{ flex: 1 }} disabled={saving || i === parts.length - 1}
                    title={`Move page ${partLetter(i)} down`}
                    onClick={() => movePart(i, +1)}>↓ Move down</button>
                </div>
              )}
            </>
          )
          return (
            <div key={pageKey} style={{ position: 'relative' }}>
              <Proposal
                pageActions={pageActions}
                ref={(el) => { pageRefs.current[p.__pid] = el; if (isLast) proposalRef.current = el }}
                mode={p.quote_type || mode}
                tpl={tplForPart(p)}
                answers={p.answers || {}}
                customSpec={p.custom_spec}
                info={{ company: client.company_name, client: client.client_name, contact: client.contact, email: client.email, address: client.address, job: client.job_name, quoteId }}
                quoteId={quoteId}
                mainView
                partLabel={multi ? partLetter(i) : null}
                multi={multi}
                isLast={isLast}
                quoteTotal={multi ? grandTotal : null}
                collectImages={multi ? collectPartImages : null}
                linkTitle={multi ? linkTitle : null}
                captureAll={multi ? captureAllPages : null}
                capturePages={multi ? capturePagesExport : null}
                canCreatePaymentLinks={canCreatePaymentLinks}
                onPaymentLinkCreated={(url) => savePaymentLink(url)}
                artworkPath={p.artwork_path}
                onArtworkFile={commitPartArtworkFile ? (f) => commitPartArtworkFile(i, f) : undefined}
                logo={logo}
                aiResult={p.ai}
                paymentLink={paymentLink}
                approval={{ locked: quote?.approval_locked, approved: quote?.price_approved }}
                proposalNotes={p.proposal_notes}
                savedState={p.proposal_state}
                sideViews={p.side_views || []}
                signBox={p.sign_box}
                onSideViews={(sv) => savePart(i, { side_views: sv })}
                onSave={(proposalState) => savePart(i, { proposal_state: proposalState })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
