// Bulk actions on the ticked rows: set status / assign / delete / clear selection.
export default function BulkActionsBar({ selIds, statuses, team, admin, onBulkStatus, onBulkAssign, onBulkDelete, onClear }) {
  if (selIds.length === 0) return null
  return (
    <div className="toolbar items-center rounded-lg border border-[rgba(249,166,0,0.35)] bg-[rgba(249,166,0,0.08)] px-2.5 py-1.5">
      <b className="whitespace-nowrap">{selIds.length} selected</b>
      <select defaultValue="" className="w-auto" title="Set this status on every selected quote" onChange={(e) => { onBulkStatus(e.target.value); e.target.value = '' }}>
        <option value="">Set status…</option>
        {statuses.map((st) => <option key={st} value={st}>{st}</option>)}
      </select>
      <select defaultValue="__none__" className="w-auto" title="Assign every selected quote to this person" onChange={(e) => { if (e.target.value !== '__none__') onBulkAssign(e.target.value); e.target.value = '__none__' }}>
        <option value="__none__">Assign to…</option>
        <option value="">— unassign —</option>
        {team.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {admin && <button className="danger sm" onClick={onBulkDelete}>Delete selected</button>}
      <button className="ghost sm" onClick={onClear}>Clear</button>
    </div>
  )
}
