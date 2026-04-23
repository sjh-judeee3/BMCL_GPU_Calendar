/* App — root. Manages state, routing, persistence via Google Sheets */
const { useState, useEffect, useMemo, useRef } = React;

// ★★★ Apps Script 배포 후 여기에 URL 붙여넣기 ★★★
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxetGI0yQ-71l0z2kikKHmmW86raFQGy1OULomikn_N4VxCUsPELdPlRypWAcxZgE9oSA/exec';

const MEMBERS_VERSION = 3;

const DEFAULT_MEMBERS = [
  { id: 'm_juhee', name: 'juhee', colorIdx: 0 },
  { id: 'm_suhyun', name: 'suhyun', colorIdx: 1 },
  { id: 'm_jiwon',  name: 'jiwon',  colorIdx: 2 },
  { id: 'm_yunji',  name: 'yunji',  colorIdx: 3 },
  { id: 'm_suheon', name: 'suheon', colorIdx: 4 },
];

// meId만 localStorage에 저장 (내가 누군지는 브라우저별로 기억)
function loadMeId() {
  try { return localStorage.getItem('lab_gpu_me') || null; } catch(e) { return null; }
}
function saveMeId(id) {
  try { localStorage.setItem('lab_gpu_me', id); } catch(e) {}
}

// ---- Google Sheets API helpers ----
async function fetchReservations() {
  const res = await fetch(APPS_SCRIPT_URL);
  const data = await res.json();
  return data.reservations || [];
}

async function apiCreate(reservation) {
  await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'create', reservation }),
  });
}

async function apiUpdate(reservation) {
  await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', reservation }),
  });
}

async function apiDelete(id) {
  await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id }),
  });
}

function App() {
  const [members] = useState(DEFAULT_MEMBERS);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState(loadMeId);
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [popover, setPopover] = useState(null);
  const [showWelcome, setShowWelcome] = useState(() => !loadMeId());

  const me = members.find(m => m.id === meId) || null;

  // 구글 시트에서 예약 불러오기
  const loadReservations = async () => {
    try {
      const resvs = await fetchReservations();
      setReservations(resvs);
    } catch(e) {
      console.error('Failed to load reservations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
    // 30초마다 자동 새로고침 (다른 사람이 예약하면 반영)
    const t = setInterval(loadReservations, 30000);
    return () => clearInterval(t);
  }, []);

  // meId 저장
  useEffect(() => { if (meId) saveMeId(meId); }, [meId]);

  // now 업데이트
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ------- Navigation -------
  const onNav = (dir) => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + dir);
    else if (view === 'week') d.setDate(d.getDate() + 7 * dir);
    else if (view === 'month') d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const title =
    view === 'day' ? GpuUtils.fmtDateLong(currentDate) :
    view === 'week' ? GpuUtils.fmtWeek(currentDate) :
    GpuUtils.fmtMonth(currentDate);

  // ------- Create / Edit handlers -------
  const handleCreate = (payload) => {
    if (!me) return;
    if (payload.batch) {
      const first = payload.batch[0];
      const last = payload.batch[payload.batch.length - 1];
      setPopover({
        mode: 'create',
        draft: {
          startSlot: first.startSlot,
          endSlot: last.endSlot,
          gpus: [],
          multiDayBatch: payload.batch,
        }
      });
      return;
    }
    setPopover({
      mode: 'create',
      draft: {
        startSlot: payload.startSlot,
        endSlot: payload.endSlot,
        gpus: payload.gpus || [],
      }
    });
  };

  const handleEdit = (resv) => {
    setPopover({ mode: 'edit', editing: resv });
  };

  const handleSaveNew = async ({ startSlot, endSlot, gpus, note, memberId }) => {
    const mem = members.find(m => m.id === memberId) || me;
    if (popover?.draft?.multiDayBatch) {
      const batch = popover.draft.multiDayBatch;
      const startD = GpuUtils.slotIndexToDate(startSlot);
      const endD = GpuUtils.slotIndexToDate(endSlot);
      const startHour = startD.getHours() * 60 + startD.getMinutes();
      const endHour = endD.getHours() * 60 + endD.getMinutes();
      const newItems = batch.map(b => {
        const bd = GpuUtils.slotIndexToDate(b.startSlot);
        const s = new Date(bd); s.setHours(0,0,0,0); s.setMinutes(startHour);
        const e = new Date(bd); e.setHours(0,0,0,0); e.setMinutes(endHour);
        return {
          id: GpuUtils.uid(), memberId: mem.id, name: mem.name, colorIdx: mem.colorIdx,
          startSlot: GpuUtils.dateToSlotIndex(s),
          endSlot: GpuUtils.dateToSlotIndex(e),
          gpus, note,
        };
      });
      // 낙관적 업데이트 (먼저 화면에 반영)
      setReservations(prev => [...prev, ...newItems]);
      setPopover(null);
      // 백그라운드에서 저장
      for (const item of newItems) await apiCreate(item);
    } else {
      const newResv = {
        id: GpuUtils.uid(), memberId: mem.id, name: mem.name, colorIdx: mem.colorIdx,
        startSlot, endSlot, gpus, note,
      };
      setReservations(prev => [...prev, newResv]);
      setPopover(null);
      await apiCreate(newResv);
    }
  };

  const handleSaveEdit = async ({ startSlot, endSlot, gpus, note, memberId }) => {
    const mem = members.find(m => m.id === memberId);
    const updated = {
      ...popover.editing,
      startSlot, endSlot, gpus, note,
      memberId: mem.id, name: mem.name, colorIdx: mem.colorIdx,
    };
    setReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
    setPopover(null);
    await apiUpdate(updated);
  };

  const handleDelete = async (id) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    setPopover(null);
    await apiDelete(id);
  };

  const handleUpdate = async (id, patch) => {
    const updated = reservations.map(r => r.id === id ? { ...r, ...patch } : r);
    setReservations(updated);
    const resv = updated.find(r => r.id === id);
    if (resv) await apiUpdate(resv);
  };

  const handleAddMember = () => {
    alert('멤버 추가는 App.jsx의 DEFAULT_MEMBERS 배열에 직접 추가해주세요!');
  };

  // ------- Keyboard shortcuts -------
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'd') setView('day');
      else if (e.key === 'w') setView('week');
      else if (e.key === 'm') setView('month');
      else if (e.key === 't') setCurrentDate(new Date());
      else if (e.key === 'ArrowLeft') onNav(-1);
      else if (e.key === 'ArrowRight') onNav(1);
      else if (e.key === 'Escape') setPopover(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, currentDate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-3)', fontSize: 15 }}>
        Loading reservations…
      </div>
    );
  }

  return (
    <div className="app">
      <Topbar
        currentDate={currentDate}
        view={view}
        onView={setView}
        onNav={onNav}
        onToday={() => setCurrentDate(new Date())}
        title={title}
        members={members}
        me={me}
        setMe={(m) => { setMeId(m.id); }}
        onAddMember={handleAddMember}
      />

      <AvailabilityStrip reservations={reservations} now={now} />

      <div className="cal-body">
        {view === 'day' && (
          <DayView
            date={currentDate}
            reservations={reservations}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onUpdate={handleUpdate}
            me={me}
            now={now}
          />
        )}
        {view === 'week' && (
          <WeekView
            date={currentDate}
            reservations={reservations}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onUpdate={handleUpdate}
            me={me}
            now={now}
          />
        )}
        {view === 'month' && (
          <MonthView
            date={currentDate}
            reservations={reservations}
            onCreate={handleCreate}
            onEdit={handleEdit}
            now={now}
          />
        )}
      </div>

      {popover && (
        <ReservationPopover
          draft={popover.draft}
          editing={popover.editing}
          reservations={reservations}
          members={members}
          me={me}
          onSave={popover.mode === 'edit' ? handleSaveEdit : handleSaveNew}
          onDelete={handleDelete}
          onClose={() => setPopover(null)}
        />
      )}

      {showWelcome && (
        <div className="empty-welcome">
          <div className="empty-welcome-card">
            <h2>Welcome to BMCL GPU Calendar</h2>
            <p>Pick your name to get started. You'll be remembered in this browser — no login needed.</p>
            <div className="avatars">
              {members.map(m => {
                const c = MEMBER_COLORS[m.colorIdx % MEMBER_COLORS.length];
                return (
                  <button
                    key={m.id}
                    className="welcome-avatar"
                    style={{ background: c.solid }}
                    onClick={() => { setMeId(m.id); setShowWelcome(false); }}
                  >{m.name}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
