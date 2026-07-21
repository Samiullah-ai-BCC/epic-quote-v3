// Presentational "Artwork & Notes" wizard step. The big-canvas crop editor and the
// click-to-pick dropzone. All upload/save handlers come from Generator().
import { fileUrl } from '../../api/client'
import ArtworkCropper from '../ArtworkCropper'

export default function ArtworkStep({
  cropping, setCropping, artworkPath, setArtworkPath, saving, signBox, setSignBox,
  commitArtworkFile, saveProgress, artInput, onArtwork, artErr, setArtErr,
  proposalNotes, setProposalNotes, toPreview,
}) {
  return (
    <div className="step">
      <div className="step-head"><span className="step-icon">🖼️</span><h3>Artwork &amp; Notes</h3></div>
      {cropping && artworkPath ? (
        // #5 — crop/edit on THIS bigger canvas (easier than the small preview-page crop)
        <ArtworkCropper
          src={fileUrl(artworkPath)}
          busy={saving}
          initialBox={signBox}
          onCancel={() => setCropping(false)}
          onApply={async (file) => { await commitArtworkFile(file); setSignBox(null); await saveProgress({ sign_box: null }); setCropping(false) }}
          onMark={async (box) => { setSignBox(box); await saveProgress({ sign_box: box }); setCropping(false); }}
        />
      ) : (<>
      {/* the whole area is clickable — clicking it opens the file picker (#21) */}
      <div
        onClick={() => artInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onArtwork({ target: { files: [f] } }) }}
        style={{ cursor: 'pointer', border: '2px dashed var(--border)', borderRadius: 10, padding: 16, textAlign: 'center', background: 'var(--navy-900)', maxWidth: 380 }}
        title="Click to pick artwork from your computer (or drop a file here)"
      >
        {artworkPath
          ? <img src={fileUrl(artworkPath)} alt="artwork" onError={(e) => { e.currentTarget.style.display = 'none'; setArtErr('The saved artwork could not be loaded — please re-upload it.') }} style={{ maxWidth: '100%', display: 'block', margin: '0 auto', borderRadius: 8 }} />
          : <div style={{ color: 'var(--text-dim)', padding: '24px 8px' }}><div style={{ fontSize: 26 }}>🖼️</div>Click to choose artwork<div style={{ fontSize: 11, marginTop: 4 }}>or drop an image here</div></div>}
        <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 8 }}>{artworkPath ? 'Click to replace' : ''}</div>
      </div>
      {artworkPath && <button className="ghost" style={{ marginTop: 10 }} onClick={() => { setArtErr(''); setCropping(true) }}>✂ Crop / edit image</button>}
      </>)}
      <input ref={artInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onArtwork} />
      {artErr && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 8 }}>{artErr}</p>}
      <div className="field" style={{ marginTop: 18 }}>
        <label>Notes for the proposal (anything special not already on the drawing)</label>
        <textarea rows={3} value={proposalNotes} onChange={(e) => setProposalNotes(e.target.value)} placeholder="e.g. install timeline, special finish, access notes…" />
      </div>
      <div className="foot">
        <span />{/* Back moved to the top-left bar (#4) */}
        <button className="ghost" onClick={() => { setArtworkPath(null); toPreview() }}>Skip artwork</button>
        <button onClick={toPreview}>{saving ? 'Saving…' : 'Next →'}</button>
      </div>
    </div>
  )
}
