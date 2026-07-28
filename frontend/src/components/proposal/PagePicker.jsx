import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'

/* "Which pages?" — the Canva-style page chooser shown before a multi-sign PDF/PNG download.
   Everything starts ticked, so the default action is exactly what the button did before this
   existed: download the whole quote. Selection lives here and is handed back on confirm; the
   caller owns the actual export. */
// The caller remounts this (via a changing `key`) every time the dialog opens, so the initial
// state below IS the reset: everything ticked, and never a stale index left over from a download
// taken before a page was added or deleted.
export default function PagePicker({ open, kind, labels, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(() => labels.map((_, i) => i))

  const toggle = (i) => setSelected((prev) => (
    prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i].sort((a, b) => a - b)
  ))

  const allOn = selected.length === labels.length
  const format = kind === 'pdf' ? 'PDF' : 'PNG'

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Download {format}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-dim -mt-1">
          Choose the pages to include. All pages are selected by default.
        </p>

        <label className="flex items-center gap-2.5 border-b border-line pb-2.5 cursor-pointer select-none">
          <Checkbox
            checked={allOn}
            onCheckedChange={() => setSelected(allOn ? [] : labels.map((_, i) => i))}
          />
          <span className="text-sm font-semibold">
            {allOn ? 'Deselect all' : 'Select all'}
          </span>
        </label>

        <div className="max-h-[300px] overflow-y-auto flex flex-col gap-0.5">
          {labels.map((label, i) => (
            <label key={i} className="flex items-center gap-2.5 py-1.5 px-1 rounded-md hover:bg-hover cursor-pointer select-none">
              <Checkbox checked={selected.includes(i)} onCheckedChange={() => toggle(i)} />
              <span className="text-sm truncate">{label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={!selected.length} onClick={() => onConfirm(selected)}>
            {selected.length === labels.length
              ? `Download all ${labels.length}`
              : `Download ${selected.length} page${selected.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
