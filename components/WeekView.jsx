/* Week view — 7 day columns × 48 half-hour bins
   Drag selects a time range and (optionally) multiple days; after release,
   ask which GPUs it applies to. */
const WEEK_SLOT_HEIGHT = 18;

function WeekView({ date, reservations, onCreate, onEdit, onUpdate, me, now }) {
  const { SLOTS_PER_DAY } = GpuUtils;
  const weekStart = GpuUtils.startOfWeek(date);
  const days = Array.from({length: 7}).map((_, i) => GpuUtils.addDays(weekStart, i));

  const scrollRef = useRef(null);
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null); // {startSlot, endSlot, startDay, endDay}
  const [moveResv, setMoveResv] = useState(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = WEEK_SLOT_HEIGHT * 16;
  }, [weekStart.toDateString()]);

  const dayFromClientX = (clientX) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const labelWidth = 60;
    const colWidth = (rect.width - labelWidth) / 7;
    const x = clientX - rect.left - labelWidth;
    return Math.max(0, Math.min(6, Math.floor(x / colWidth)));
  };
  const slotFromClientY = (clientY) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(0, Math.min(SLOTS_PER_DAY - 1, Math.floor(y / WEEK_SLOT_HEIGHT)));
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      setDrag(d => ({ ...d, endSlot: slotFromClientY(e.clientY), endDay: dayFromClientX(e.clientX) }));
    };
    const onUp = () => {
      const d = drag;
      setDrag(null);
      const s1 = Math.min(d.startSlot, d.endSlot);
      const s2 = Math.max(d.startSlot, d.endSlot) + 1;
      const d1 = Math.min(d.startDay, d.endDay);
      const d2 = Math.max(d.startDay, d.endDay);
      // If a single day, create one reservation. If multi-day, create one per day with same hours.
      const creates = [];
      for (let di = d1; di <= d2; di++) {
        const dayBase = GpuUtils.dateToSlotIndex(new Date(days[di].getFullYear(), days[di].getMonth(), days[di].getDate(), 0, 0));
        creates.push({ startSlot: dayBase + s1, endSlot: dayBase + s2, gpus: null /* ask */ });
      }
      onCreate({ batch: creates });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag]);

  useEffect(() => {
    if (!moveResv) return;
    const onMove = (e) => {
      const rect = gridRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slotDelta = Math.round((y - moveResv.originY) / WEEK_SLOT_HEIGHT);
      setMoveResv(m => ({ ...m, slotDelta }));
    };
    const onUp = () => {
      const r = reservations.find(x => x.id === moveResv.id);
      if (!r) { setMoveResv(null); return; }
      const delta = moveResv.slotDelta || 0;
      if (delta !== 0) {
        let newStart = r.startSlot, newEnd = r.endSlot;
        if (moveResv.mode === 'move') { newStart = moveResv.originalStart + delta; newEnd = moveResv.originalEnd + delta; }
        else if (moveResv.mode === 'resize-top') { newStart = Math.min(moveResv.originalEnd - 1, moveResv.originalStart + delta); }
        else if (moveResv.mode === 'resize-bottom') { newEnd = Math.max(moveResv.originalStart + 1, moveResv.originalEnd + delta); }
        onUpdate(r.id, { startSlot: newStart, endSlot: newEnd });
      }
      setMoveResv(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [moveResv, reservations]);

  const onGridMouseDown = (e) => {
    if (e.target.closest('.resv')) return;
    const slot = slotFromClientY(e.clientY);
    const day = dayFromClientX(e.clientX);
    setDrag({ startSlot: slot, endSlot: slot, startDay: day, endDay: day });
    e.preventDefault();
  };

  return (
    <div className="week-view">
      <div className="week-header">
        <div />
        {days.map((d, i) => {
          const isToday = GpuUtils.sameDay(d, now);
          return (
            <div key={i} className={`week-day-header ${isToday ? 'today' : ''}`}>
              <div className="dow">{['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]}</div>
              <div className="dom">{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="week-scroll" ref={scrollRef}>
        <div
          className="week-grid"
          ref={gridRef}
          style={{ height: WEEK_SLOT_HEIGHT * SLOTS_PER_DAY + 'px' }}
          onMouseDown={onGridMouseDown}
        >
          {/* Labels */}
          <div style={{ position: 'relative' }}>
            {Array.from({length: 24}).map((_, h) => (
              <div
                key={h}
                className={`hour-label ${h === 0 ? 'first' : ''}`}
                style={{ position: 'absolute', top: h * 2 * WEEK_SLOT_HEIGHT, height: 2 * WEEK_SLOT_HEIGHT, width: '100%' }}
              >
                {h !== 0 && <span>{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}</span>}
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {days.map((d, di) => {
            const dayResvs = GpuUtils.resvsOnDate(reservations, d);
            const isToday = GpuUtils.sameDay(d, now);
            return (
              <div key={di} className="week-day-col">
                {Array.from({length: SLOTS_PER_DAY}).map((_, s) => (
                  <div key={s} className={`slot ${s % 2 === 1 ? 'half' : ''}`} style={{ height: WEEK_SLOT_HEIGHT }} />
                ))}

                {/* Lay out reservations as vertical blocks; stack side-by-side when overlapping */}
                {(() => {
                  // Compute columns per day for overlap
                  const items = dayResvs.map(r => {
                    const c = GpuUtils.clampToDay(r, d);
                    return { r, top: c.startOffset * WEEK_SLOT_HEIGHT, height: (c.endOffset - c.startOffset) * WEEK_SLOT_HEIGHT, start: c.startSlot, end: c.endSlot };
                  });
                  // Greedy column assignment
                  items.sort((a, b) => a.start - b.start);
                  const cols = []; // end slot per column
                  items.forEach(it => {
                    let placed = false;
                    for (let i = 0; i < cols.length; i++) {
                      if (cols[i] <= it.start) { cols[i] = it.end; it.col = i; placed = true; break; }
                    }
                    if (!placed) { it.col = cols.length; cols.push(it.end); }
                  });
                  const totalCols = Math.max(1, cols.length);
                  return items.map(({ r, top, height, col }) => {
                    let t = top, h = height;
                    let previewStart = r.startSlot, previewEnd = r.endSlot;
                    if (moveResv && moveResv.id === r.id && moveResv.slotDelta) {
                      const d = moveResv.slotDelta;
                      if (moveResv.mode === 'move') { t += d * WEEK_SLOT_HEIGHT; previewStart += d; previewEnd += d; }
                      else if (moveResv.mode === 'resize-top') { t += d * WEEK_SLOT_HEIGHT; h -= d * WEEK_SLOT_HEIGHT; previewStart = Math.min(previewEnd - 1, previewStart + d); }
                      else if (moveResv.mode === 'resize-bottom') { h += d * WEEK_SLOT_HEIGHT; previewEnd = Math.max(previewStart + 1, previewEnd + d); }
                    }
                    const color = MEMBER_COLORS[r.colorIdx % MEMBER_COLORS.length];
                    const startDate = GpuUtils.slotIndexToDate(previewStart);
                    const endDate = GpuUtils.slotIndexToDate(previewEnd);
                    const durationMin = (previewEnd - previewStart) * GpuUtils.SLOT_MINUTES;
                    const isActive = moveResv?.id === r.id && moveResv?.slotDelta;
                    const widthPct = 100 / totalCols;
                    return (
                      <div
                        key={r.id + '-' + di}
                        className={`resv ${moveResv?.id === r.id ? 'dragging' : ''}`}
                        style={{
                          top: t, height: Math.max(12, h),
                          left: `calc(${col * widthPct}% + 2px)`,
                          right: 'auto',
                          width: `calc(${widthPct}% - 4px)`,
                          '--resv-color': color.solid,
                          '--resv-bg': color.tint,
                          padding: '2px 4px',
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setMoveResv({
                            id: r.id, mode: 'move',
                            originY: e.clientY - gridRef.current.getBoundingClientRect().top,
                            originalStart: r.startSlot, originalEnd: r.endSlot,
                          });
                        }}
                        onClick={(e) => { e.stopPropagation(); if (!moveResv) onEdit(r); }}
                        title={`${r.name}: ${GpuUtils.fmtTime(startDate)} – ${GpuUtils.fmtTime(endDate)} · GPU ${r.gpus.join(',')}`}
                      >
                        <div
                          className="resv-resize top"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setMoveResv({
                              id: r.id, mode: 'resize-top',
                              originY: e.clientY - gridRef.current.getBoundingClientRect().top,
                              originalStart: r.startSlot, originalEnd: r.endSlot,
                            });
                          }}
                        />
                        <div className="resv-name" style={{fontSize: 10}}>{r.name}</div>
                        <div className="resv-time" style={{fontSize: 9, ...(isActive ? { color: color.solid, fontWeight: 600 } : {})}}>
                          {isActive
                            ? <span>{GpuUtils.fmtTimeShort(startDate)}–{GpuUtils.fmtTimeShort(endDate)}</span>
                            : <span>GPU {r.gpus.join(',')} · {GpuUtils.fmtTimeShort(startDate)}</span>}
                        </div>
                        {isActive && (
                          <div className="resv-duration-badge">{GpuUtils.humanDuration(durationMin)}</div>
                        )}
                        <div
                          className="resv-resize bottom"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setMoveResv({
                              id: r.id, mode: 'resize-bottom',
                              originY: e.clientY - gridRef.current.getBoundingClientRect().top,
                              originalStart: r.startSlot, originalEnd: r.endSlot,
                            });
                          }}
                        />
                      </div>
                    );
                  });
                })()}

                {/* now line in today's column */}
                {isToday && (() => {
                  const mins = now.getHours() * 60 + now.getMinutes();
                  return <div className="now-line" style={{ top: (mins / 30) * WEEK_SLOT_HEIGHT }} />;
                })()}
              </div>
            );
          })}

          {/* Drag rectangle */}
          {drag && (() => {
            const s1 = Math.min(drag.startSlot, drag.endSlot);
            const s2 = Math.max(drag.startSlot, drag.endSlot) + 1;
            const d1 = Math.min(drag.startDay, drag.endDay);
            const d2 = Math.max(drag.startDay, drag.endDay) + 1;
            if (!gridRef.current) return null;
            const rect = gridRef.current.getBoundingClientRect();
            const labelWidth = 60;
            const colWidth = (rect.width - labelWidth) / 7;
            return (
              <div
                className="drag-rect"
                style={{
                  left: labelWidth + d1 * colWidth + 2,
                  width: (d2 - d1) * colWidth - 4,
                  top: s1 * WEEK_SLOT_HEIGHT,
                  height: (s2 - s1) * WEEK_SLOT_HEIGHT,
                }}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}

window.WeekView = WeekView;
