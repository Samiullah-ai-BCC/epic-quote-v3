import { Label } from '../../ui/label'
import { Textarea } from '../../ui/textarea'
import { Button } from '../../ui/button'

// AI mode intake: inline File/Text toggle, upload or paste, and the Read/Re-read triggers.
// All the actual reading (rasterize + extractParty + merge) lives in the modal.
export default function AiIntake({ source, setSource, files, onFilesChange, specText, onSpecTextChange, revealed, autofilling, onReadText }) {
  return (
    <>
      <div className="seg">
        <button type="button" className={'seg-btn' + (source === 'file' ? ' on' : '')} onClick={() => setSource('file')}>📄 Upload file(s)</button>
        <button type="button" className={'seg-btn' + (source === 'text' ? ' on' : '')} onClick={() => setSource('text')}>✉️ Paste text</button>
      </div>

      {source === 'file' ? (
        <div className="grid gap-1.5 mt-3 mb-3">
          <Label>Upload the sign drawing(s) — PDF or image, you can add more than one (max 25 MB each)</Label>
          <input type="file" accept=".pdf,image/*" multiple autoFocus
            onChange={(e) => onFilesChange(Array.from(e.target.files || []))} />
          {files.length > 0 && <div className="muted mt-1.5 text-xs">{files.length} file(s): {files.map((f) => f.name).join(', ')}</div>}
        </div>
      ) : (
        <div className="grid gap-1.5 mt-3 mb-3">
          <Label>Paste the customer's email or brief</Label>
          <Textarea rows={4} value={specText} onChange={(e) => onSpecTextChange(e.target.value)} placeholder="Paste here…" />
          {!revealed && (
            <Button type="button" variant="outline" size="sm" className="mt-1.5 justify-self-start" disabled={autofilling || !specText.trim()} onClick={onReadText}>
              {autofilling ? 'Reading…' : 'Read it →'}
            </Button>
          )}
        </div>
      )}

      {!revealed && (
        <p className="muted text-[13px]">
          {autofilling ? '⏳ Reading your upload(s) and filling the details…' : 'The company, client, contact, address and job will fill in here once AI reads.'}
        </p>
      )}
    </>
  )
}
