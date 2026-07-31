// Presentational final "Proposal" wizard step: the stacked, per-part proposal pages plus
// the Done / Add-page / Undo-delete toolbar. Every callback (savePart, addPage, deletePage,
// the capture collectors, savePaymentLink…) is defined in Generator() and passed in — this
// component threads them into each <Proposal> without owning any state.
import { Fragment } from 'react'
import { partLetter } from '../../generator/parts'
import { pageSequence, hasBlankPage } from '../../pages/generator/hooks/usePageCapture'
import Proposal from '../Proposal'
import ClientDocPage from './ClientDocPage'

export default function PreviewStep({
  parts, cpBusy, cpMsg, saving, saveCheckpoint, navigate, exitTo, addPage,
  setExitAsk, deletedPage, undoDeletePage, deleteTimer, setDeletedPage,
  multiPreviewRef, grandTotal, tplForPart, client, quoteId,
  collectPartImages, linkTitle, captureAllPages, capturePagesExport,
  canCreatePaymentLinks, savePaymentLink, logo, paymentLink, quote,
  savePart, commitPartArtworkFile, movePart, pageRefs, docRefs, proposalRef, mode, editPart, editArtwork, deletePage, duplicatePage,
  specialRequirements, commitPartClientDoc, docBusy, docErr,
  addBlankPage, removeBlankPage, onEditSpecs,
}) {
  // The document's real sheet order — a page's blank page, then the page. Built by the SAME
  // function capturePagesExport walks, so what the picker lists, what the preview stacks and what
  // the PDF contains are one sequence in one order. That shared source is the only thing that
  // stops the three drifting apart.
  const sequence = pageSequence(parts)
  const signLabel = (part, n) => `Page ${partLetter(n)} — ${tplForPart(part)?.n || 'Sign'}`
  // Any blank page at all puts the download on the multi-sheet path, even for a one-sign quote:
  // otherwise Proposal exports its own DOM alone and the added sheet is missing from the file the
  // customer receives. Switching the existing multipager on is also what gives "blank only /
  // proposal only / both" for free, with no second export path to keep in step.
  const multiSheet = sequence.length > 1
  const labelFor = (entry) => (
    entry.kind === 'blank'
      ? `Blank page${parts.length > 1 ? ' ' + partLetter(entry.index) : ''}`
      : (parts.length > 1 ? signLabel(entry.part, entry.index) : `Proposal — ${tplForPart(entry.part)?.n || 'Sign'}`)
  )
  // Picker labels are the sequence itself, in order, so a tick maps to a sheet by position (`seq`)
  // with no second numbering scheme to keep aligned.
  const docLabels = multiSheet ? sequence.map(labelFor) : null
  // Quote-level actions (Back / Done) live at the TOP of the FIRST page's
  // controls column — the old toolbar row above the sheet (plus the "Proposal" heading and the
  // .step panel chrome) was pure vertical waste on the one step where the sheet needs every
  // pixel. Only ONE "Edit specs" entry point (#12) — the per-page row below, which knows
  // exactly which sign it edits. Done = save everything + mint the version (rev + image).
  const quoteActions = (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="ghost sm" style={{ flex: 1 }} onClick={() => setExitAsk(true)}>← Back</button>
        <button className="sm" style={{ flex: 1 }} disabled={!!cpBusy || saving}
          title="Save everything, record this version (rev with the rendered proposal image) and return"
          onClick={async () => { await saveCheckpoint(); navigate(exitTo) }}>
          {cpBusy ? 'Saving…' : '✓ Done'}
        </button>
      </div>
      {/* The preview step hides WizardHeader (it takes ~90px the sheet needs), so the only
          "Edit quote specs" entry point on the step where the rep reads the proposal header is
          here. Quote-level like Back/Done, so it lives with them on page A and is not repeated
          down the column. */}
      {onEditSpecs && (
        <button className="ghost sm" style={{ width: '100%' }} onClick={onEditSpecs}
          title="Edit the job name, proposal ID, company, client, contact and address saved against this quote">
          ✎ Edit customer details
        </button>
      )}
      {cpMsg && <span className="muted" style={{ fontSize: 12.5 }}>{cpMsg}</span>}
    </>
  )

  // "+ Add sign page" is rendered beside EVERY page, not just the first. addPage always appends to
  // the end and jumps into the new sign's specs, so it behaves identically wherever it is clicked
  // — and on a long multi-sign quote, having it only at the top meant scrolling back up to add
  // each new sign. Back / Done stay on the first page only: those are once-per-quote actions and
  // repeating them down the column would invite clicking "Done" while reading page C.
  const addPageButton = (
    <button className="ghost sm" disabled={saving} style={{ width: '100%' }}
      title="Add another sign to this quote — one client, one combined total"
      onClick={addPage}>＋ Add sign page</button>
  )
  // Sits beside "+ Add sign page" and reads the same way, but puts THIS page's blank page in front
  // of it instead of adding another sign at the end. The blank page is the client-document sheet —
  // same sheet, same attach-a-file input it has always had. It used to be there whether the rep
  // wanted it or not; now it arrives on this click and goes away on Remove.
  //
  // It is not a sign: no letter, no proposal ID suffix, no share of the total.
  //
  // Removal is refused while a document is attached. The button would otherwise be a one-click
  // delete of the customer's own file with no confirmation — Remove on the sheet itself takes the
  // file off first, which is the deliberate path.
  const blankPageButton = (i, on, docAttached) => addBlankPage && (
    on
      ? (
        <button className="ghost sm" disabled={saving || docAttached} style={{ width: '100%' }}
          title={docAttached
            ? 'Remove the attached document from the blank page first'
            : `Remove the blank page in front of ${parts.length > 1 ? 'page ' + partLetter(i) : 'the proposal'}`}
          onClick={() => removeBlankPage && removeBlankPage(i)}>－ Remove blank page</button>
      )
      : (
        <button className="ghost sm" disabled={saving} style={{ width: '100%' }}
          title={`Add a blank page in front of ${parts.length > 1 ? 'page ' + partLetter(i) : 'the proposal'} — printed with the quote, and the client's document can be attached to it`}
          onClick={() => addBlankPage(i)}>＋ Add blank page</button>
      )
  )
  return (
    <div>
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
          // Whether THIS page carries a blank page. Same test the exporter uses, so the sheet a rep
          // sees and the sheet the PDF contains can never disagree.
          const blankOn = hasBlankPage(p)
          // Per-page actions render INSIDE the page's own controls column (Proposal pageActions):
          // as a flow row above the page they pushed the whole sheet down (the dead white band).
          // Living in the column they stay glued to THEIR page — after a reorder each row still
          // edits/moves/deletes the sign it sits beside, because everything closes over `i` of
          // the freshly-mapped render.
          const pageActions = (
            <>
              {i === 0 && quoteActions}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ghost sm" style={{ flex: 1 }} onClick={() => editPart(i)} disabled={saving}
                  title={`Edit the sign type & specifications of page ${multi ? partLetter(i) : ''}`.trim()}>
                  ✎ Edit specs{multi ? ' ' + partLetter(i) : ''}
                </button>
                {/* Artwork is its own pipeline now: editing a spec no longer drags the rep through
                    the artwork step to get back to the preview. Closes over THIS row's `i`, so on a
                    multi-sign quote it edits the artwork of the page it sits beside — and after a
                    reorder it still does, because the row is rebuilt from the fresh map. */}
                {editArtwork && (
                  <button className="ghost sm" style={{ flex: 1 }} onClick={() => editArtwork(i)} disabled={saving}
                    title={`Add, replace or crop the artwork on page ${multi ? partLetter(i) : ''}`.trim()}>
                    🖼 Edit artwork{multi ? ' ' + partLetter(i) : ''}
                  </button>
                )}
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
              {addPageButton}
              {/* Sits under "+ Add sign page" and is its shortcut: same result (one more sign page)
                  but pre-filled from THIS page instead of empty, and landing directly after it
                  rather than at the end. The rep stays on the preview — nothing to re-walk, because
                  every spec is already copied. Edits to the copy are the ordinary per-page edits:
                  the ✎ / 🖼 / ↑↓ / 🗑 row beside the copy edits the copy alone. */}
              {duplicatePage && (
                <button className="ghost sm" disabled={saving} style={{ width: '100%' }}
                  title={`Duplicate ${multi ? 'page ' + partLetter(i) : 'this page'} — an identical sign page is inserted right after it, ready to edit`}
                  onClick={() => duplicatePage(i)}>⧉ Duplicate page{multi ? ' ' + partLetter(i) : ''}</button>
              )}
              {blankPageButton(i, blankOn, !!p.client_doc)}
            </>
          )
          return (
            <Fragment key={pageKey}>
            {/* THE BLANK PAGE, in front of the sign it belongs to. Same client-document sheet as
                before — same attach input, same capture handle — but opt-in, and above the
                proposal instead of below it. The sheet order on screen is the sheet order in the
                PDF because both read `pageSequence`.

                Same width as the sheet beside it: the Proposal's own layout is
                [sheet flex:1] + [220px controls column] + 16px gap, so the blank page has to give
                those 236px back or it would render WIDER than the proposal under it. */}
            {blankOn && (
              <div style={{ maxWidth: 'calc(100% - 236px)' }}>
                <ClientDocPage
                  ref={(el) => { if (docRefs) docRefs.current[p.__pid] = el }}
                  doc={p.client_doc || null}
                  label={multi ? partLetter(i) : null}
                  busy={docBusy === p.__pid || saving}
                  errorText={docBusy === null ? docErr : ''}
                  onPick={(file) => commitPartClientDoc && commitPartClientDoc(i, file)}
                  onRemove={() => savePart(i, { client_doc: null })}
                />
              </div>
            )}
            <div style={{ position: 'relative' }}>
              {/* captureAll is the version-history snapshot: it already carried the client-document
                  sheets and still does, so a revision records everything the customer would see.
                  capturePages/pageLabels are switched on by a blank page — that is the multipager,
                  and it is what gives "blank only / proposal only / both" without a second code path.
                  signPageCount says how many of those sheets are signs: runPDF needs it to find the
                  last SIGN page for the clickable payment link, and counting pageLabels would count
                  the blank pages too and pin the link to the wrong sheet. */}
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
                captureAll={multiSheet ? captureAllPages : null}
                capturePages={multiSheet ? capturePagesExport : null}
                pageLabels={multiSheet ? docLabels : null}
                signPageCount={parts.length}
                canCreatePaymentLinks={canCreatePaymentLinks}
                onPaymentLinkCreated={(url) => savePaymentLink(url)}
                artworkPath={p.artwork_path}
                onArtworkFile={commitPartArtworkFile ? (f) => commitPartArtworkFile(i, f) : undefined}
                logo={logo}
                aiResult={p.ai}
                paymentLink={paymentLink}
                approval={{ locked: quote?.approval_locked, approved: quote?.price_approved }}
                proposalNotes={p.proposal_notes}
                specialRequirements={specialRequirements || quote?.special_requirements || ''}
                savedState={p.proposal_state}
                sideViews={p.side_views || []}
                signBox={p.sign_box}
                onSideViews={(sv) => savePart(i, { side_views: sv })}
                onSave={(proposalState) => savePart(i, { proposal_state: proposalState })}
              />
            </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
