/* Reservation popover — create / edit, with GPU chips, time, note, conflict warn */

function ReservationPopover({ draft, editing, reservations, members, me, onSave, onDelete, onClose }) {
  const initial = editing || draft;
  const [gpus, setGpus] = useState(() => {
    if (editing) return [...editing.gpus];
    if (draft && draft.gpus) return [...draft.gpus];
    return [];
  });
  const [startSlot, setStartSlot] = useState(initial.startSlot);
  const [endSlot, setEndSlot] = useState(initial.endSlot);
  const [note, setNote] = useState(editing ? (editing.note || '') : '');
  const [memberId, setMemberId] = useState(editing ? editing.memberId : (me?.id));

  const startDate = GpuUtils.slotIndexToDate(startSlot);
  const endDate = GpuUtils.slotIndexToDate(endSlot);

  const slotsToInputTime = (slot) => {
    const d = GpuUtils.slotIndexToDate(slot);
    return `${GpuUtils.pad2(d.getHours())}:${GpuUtils.pad2(d.getMinutes())}`;
  };
  const inputTimeToSlot = (dateRef, str) => {
    const [h, m] = str.split(':').map(Number);
    const d = new Date(dateRef);
    d.setHours(h, m, 0, 0);
    return GpuUtils.dateToSlotIndex(d);
  };

  const slotsToInputDate = (slot) => GpuUtils.ymd(GpuUtils.slotIndexToDate(slot));

  // Compute conflicts preview
  const pending = { id: editing?.id || '__tmp__', startSlot, endSlot, gpus };
  const conflictList = useMemo(() => {
    if (gpus.length === 0) return [];
    return reservations.filter(r => r.id !== pending.id && r.endSlot > startSlot && r.startSlot < endSlot && r.gpus.some(g => gpus.includes(g)));
  }, [startSlot, endSlot, gpus.join(','), reservations]);

  const save = () => {
    if (gpus.length === 0) return;
    if (endSlot <= startSlot) return;
    onSave({ startSlot, endSlot, gpus, note: note.trim(), memberId });
  };

  const dateObj = GpuUtils.slotIndexToDate(startSlot);
  const endDateObj = GpuUtils.slotIndexToDate(endSlot);
  const multiDay = !GpuUtils.sameDay(dateObj, endDateObj);

  return (
    <div className="popover-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="popover" onMouseDown={e => e.stopPropagation()}>
        <h3>{editing ? 'Edit reservation' : 'New reservation'}</h3>
        <div className="subtitle">
          {GpuUtils.fmtDateLong(dateObj)}
          {multiDay && ` → ${GpuUtils.fmtDateLong(endDateObj)}`}
        </div>

        {conflictList.length > 0 && (
          <div className="conflict-warn">
            <span>⚠️</span>
            <div>
              <strong>Overlaps {conflictList.length} reservation{conflictList.length > 1 ? 's' : ''}</strong>
              <div style={{marginTop: 2}}>
                {conflictList.slice(0, 3).map(c => (
                  <div key={c.id}>{c.name} · GPU {c.gpus.join(',')} · {GpuUtils.fmtTimeShort(GpuUtils.slotIndexToDate(c.startSlot))}–{GpuUtils.fmtTimeShort(GpuUtils.slotIndexToDate(c.endSlot))}</div>
                ))}
              </div>
              <div style={{marginTop: 4, fontSize: 11}}>You can still reserve — lab allows sharing.</div>
            </div>
          </div>
        )}

        <div className="field">
          <label>GPUs</label>
          <div className="gpu-chips">
            {Array.from({length: GpuUtils.GPU_COUNT}).map((_, g) => (
              <button
                key={g}
                type="button"
                className={`gpu-chip ${gpus.includes(g) ? 'active' : ''}`}
                onClick={() => setGpus(gpus.includes(g) ? gpus.filter(x => x !== g) : [...gpus, g].sort())}
              >
                GPU {g}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>When</label>
          <div className="time-row">
            <div>
              <input
                type="date"
                value={slotsToInputDate(startSlot)}
                onChange={(e) => {
                  const newDate = GpuUtils.parseYmd(e.target.value);
                  const d = GpuUtils.slotIndexToDate(startSlot);
                  newDate.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  const duration = endSlot - startSlot;
                  const ns = GpuUtils.dateToSlotIndex(newDate);
                  setStartSlot(ns); setEndSlot(ns + duration);
                }}
                style={{marginBottom: 4}}
              />
              <input
                type="time"
                step="1800"
                value={slotsToInputTime(startSlot)}
                onChange={(e) => {
                  const ns = inputTimeToSlot(GpuUtils.slotIndexToDate(startSlot), e.target.value);
                  setStartSlot(ns);
                  if (endSlot <= ns) setEndSlot(ns + 1);
                }}
              />
            </div>
            <div className="arrow">→</div>
            <div>
              <input
                type="date"
                value={slotsToInputDate(endSlot)}
                onChange={(e) => {
                  const newDate = GpuUtils.parseYmd(e.target.value);
                  const d = GpuUtils.slotIndexToDate(endSlot);
                  newDate.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  setEndSlot(GpuUtils.dateToSlotIndex(newDate));
                }}
                style={{marginBottom: 4}}
              />
              <input
                type="time"
                step="1800"
                value={slotsToInputTime(endSlot)}
                onChange={(e) => {
                  const ns = inputTimeToSlot(GpuUtils.slotIndexToDate(endSlot), e.target.value);
                  setEndSlot(Math.max(startSlot + 1, ns));
                }}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label>Reserved by</label>
          <select value={memberId || ''} onChange={e => setMemberId(e.target.value)}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Note <span style={{textTransform:'none', fontWeight: 400, color: 'var(--text-4)'}}>(optional — e.g. training run, model name)</span></label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. fine-tuning val set, OOM risk" />
        </div>

        <div className="popover-actions">
          {editing && (
            <button className="btn btn-danger left" onClick={() => {
              if (confirm(`Cancel reservation "${editing.name} · ${GpuUtils.fmtTimeShort(GpuUtils.slotIndexToDate(editing.startSlot))}"?`)) {
                onDelete(editing.id);
              }
            }}>Delete</button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={gpus.length === 0 || endSlot <= startSlot}>
            {editing ? 'Save' : 'Reserve'}
          </button>
        </div>
      </div>
    </div>
  );
}

window.ReservationPopover = ReservationPopover;
