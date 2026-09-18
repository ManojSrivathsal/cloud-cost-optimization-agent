import React from 'react';

function DemoEventNotifications({ events, onClearEvents }) {
  if (!events || events.length === 0) return null;

  // Show last 4 events
  const visibleEvents = events.slice(-4).reverse();

  return (
    <aside className="demo-event-feed-panel" aria-label="Real-time Operational Telemetry Stream">
      <div className="feed-header">
        <div className="feed-title-wrap">
          <span className="feed-pulse-dot"></span>
          <span className="feed-title">LIVE EVENT STREAM</span>
          <span className="feed-count mono">{events.length}</span>
        </div>
        <button
          type="button"
          className="feed-clear-btn"
          onClick={onClearEvents}
          title="Clear event history"
        >
          Clear
        </button>
      </div>

      <div className="feed-items-list">
        {visibleEvents.map((ev) => (
          <div key={ev.id} className={`feed-item-toast toast-${ev.type || 'info'}`}>
            <span className="toast-icon">{ev.icon || 'ℹ️'}</span>
            <div className="toast-content">
              <div className="toast-header-row">
                <span className="toast-time mono">{ev.time}</span>
                <span className="toast-stage-tag mono">{ev.stage.toUpperCase()}</span>
              </div>
              <p className="toast-text">{ev.text}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default DemoEventNotifications;
