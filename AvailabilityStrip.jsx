/* Availability-now strip */

function AvailabilityStrip({ reservations, now }) {
  const avail = GpuUtils.availabilityNow(reservations, now);
  return (
    <div className="avail-strip">
      <div className="avail-strip-label">Right&nbsp;now</div>
      {avail.map(a => (
        <div key={a.gpu} className={`avail-card ${a.busy ? 'busy' : ''}`}>
          <span className={`avail-dot ${a.busy ? 'busy' : ''}`} />
          <div className="avail-gpu-num">GPU {a.gpu}</div>
          <div className="avail-status">
            {a.busy ? (
              <div className="busy">
                <div className="status">In use</div>
                <div className="detail">{a.name} · {GpuUtils.untilText(a.until, now)}</div>
              </div>
            ) : (
              <div className="free">
                <div className="status">Free</div>
                <div className="detail">
                  {a.until
                    ? `${GpuUtils.untilText(a.until, now)} · ${a.next}`
                    : 'no upcoming reservations'}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

window.AvailabilityStrip = AvailabilityStrip;
