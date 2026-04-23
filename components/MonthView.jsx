/* Month view — traditional 6-row calendar grid. Drag across days to select; after release ask for hours+GPUs */

function MonthView({ date, reservations, onCreate, onEdit, now }) {
  const monthStart = GpuUtils.startOfMonth(date);
  const monthEnd = GpuUtils.endOfMonth(date);
  const gridStart = GpuUtils.startOfWeek(monthStart);
  // 6 rows × 7 cols
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(GpuUtils.addDays(gridStart, i));

  const [drag, setDrag] = useState(null); // {startIdx, endIdx}

  useEffect(() => {
    if (!drag) return;
    const onUp = () => {
      const d = drag;
      setDrag(null);
      const i1 = Math.min(d.startIdx, d.endIdx);
      const i2 = Math.max(d.startIdx, d.endIdx);
      const dayStart = cells[i1];
      const dayEnd = cells[i2];
      // Create one pending reservation spanning all selected days (all-day default 9am-6pm, ask gpus)
      const startSlot = GpuUtils.dateToSlotIndex(new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 9, 0));
      const endSlot = GpuUtils.dateToSlotIndex(new Date(dayEnd.getFullYear(), dayEnd.getMonth(), dayEnd.getDate(), 18, 0));
      if (GpuUtils.sameDay(dayStart, dayEnd)) {
        onCreate({ startSlot, endSlot, gpus: null, askHours: true });
      } else {
        // Multi-day → create one per day with same hours. Popover asks hours+gpus and we fan-out.
        const batch = [];
        for (let i = i1; i <= i2; i++) {
          const d = cells[i];
          const s = GpuUtils.dateToSlotIndex(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0));
          const e = GpuUtils.dateToSlotIndex(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0));
          batch.push({ startSlot: s, endSlot: e, gpus: null });
        }
        onCreate({ batch, askHours: true });
      }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drag]);

  return (
    <div className="month-view">
      <div className="month-dow-header">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="month-grid">
        {cells.map((cellDate, idx) => {
          const isThisMonth = cellDate.getMonth() === date.getMonth();
          const isToday = GpuUtils.sameDay(cellDate, now);
          const dayResvs = GpuUtils.resvsOnDate(reservations, cellDate);
          const inDrag = drag && idx >= Math.min(drag.startIdx, drag.endIdx) && idx <= Math.max(drag.startIdx, drag.endIdx);
          const MAX_PILLS = 3;
          return (
            <div
              key={idx}
              className={`month-cell ${isThisMonth ? '' : 'other-month'} ${isToday ? 'today' : ''} ${inDrag ? 'selecting' : ''}`}
              onMouseDown={(e) => {
                if (e.target.closest('.month-resv-pill')) return;
                setDrag({ startIdx: idx, endIdx: idx });
                e.preventDefault();
              }}
              onMouseEnter={() => { if (drag) setDrag(d => ({ ...d, endIdx: idx })); }}
            >
              <div className="month-cell-num">{cellDate.getDate()}</div>
              {dayResvs.slice(0, MAX_PILLS).map(r => {
                const color = MEMBER_COLORS[r.colorIdx % MEMBER_COLORS.length];
                const startDate = GpuUtils.slotIndexToDate(r.startSlot);
                return (
                  <div
                    key={r.id + '-' + idx}
                    className="month-resv-pill"
                    style={{ '--resv-color': color.solid, '--resv-bg': color.tint }}
                    onClick={(e) => { e.stopPropagation(); onEdit(r); }}
                    title={`${r.name} · GPU ${r.gpus.join(',')} · ${GpuUtils.fmtTimeShort(startDate)}`}
                  >
                    <span className="dot" />
                    <span style={{fontWeight: 600}}>{GpuUtils.fmtTimeShort(startDate)}</span>
                    {' '}{r.name}
                    {r.gpus.length === 1 ? ` · G${r.gpus[0]}` : ` · G${r.gpus.join('/')}`}
                  </div>
                );
              })}
              {dayResvs.length > MAX_PILLS && (
                <div className="month-resv-more">+{dayResvs.length - MAX_PILLS} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.MonthView = MonthView;
