/* Topbar — brand, member picker, view switch, nav, today */
const { useState, useEffect, useRef, useMemo } = React;

function Topbar({ currentDate, view, onView, onNav, onToday, title, members, me, setMe, onAddMember }) {
  const myColor = me ? MEMBER_COLORS[me.colorIdx % MEMBER_COLORS.length].solid : '#8e8e93';

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-dot" />
        <span>BMCL GPU Calendar</span>
      </div>

      <div className="view-switch">
        {['day','week','month'].map(v => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => onView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <button className="today-btn" onClick={onToday}>Today</button>

      <div className="nav-arrows">
        <button onClick={() => onNav(-1)} title="Previous">‹</button>
        <div className="sep" />
        <button onClick={() => onNav(1)} title="Next">›</button>
      </div>

      <div className="date-title">{title}</div>

      <div className="topbar-spacer" />

      <div className="member-picker">
        <span className="swatch" style={{ background: myColor }} />
        <select
          value={me ? me.id : ''}
          onChange={e => {
            if (e.target.value === '__add__') {
              onAddMember();
            } else {
              setMe(members.find(m => m.id === e.target.value));
            }
          }}
        >
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
          <option value="__add__">+ Add member…</option>
        </select>
      </div>
    </div>
  );
}

window.Topbar = Topbar;
