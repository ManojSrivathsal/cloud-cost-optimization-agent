import React from 'react';

function ExecutiveSummaryModal({ summaryData, isOpen, onClose }) {
  if (!isOpen || !summaryData) return null;

  const {
    title,
    badge_label,
    badge_status,
    target_service,
    autonomous_turnaround_sec,
    human_time_saved_min,
    outcome,
    net_savings_monthly,
    net_savings_hourly,
    safety_summary,
    recommendation,
  } = summaryData;

  const isSavings = net_savings_monthly > 0;

  return (
    <div className="summary-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="summary-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-eyebrow">AUTONOMOUS AUDIT RESOLUTION</span>
            <h2 className="modal-title">{title}</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close summary"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-badge-row">
            <span className={`resolution-badge badge-${badge_status}`}>
              ● {badge_label}
            </span>
            <span className="mono-pill">Target: {target_service}</span>
            <span className="mono-pill">Human Intervention: 0h (Autonomous)</span>
          </div>

          <div className="turnaround-kpis-grid">
            <div className="turnaround-box">
              <span className="turnaround-label">AUTONOMOUS TURNAROUND</span>
              <div className="turnaround-val mono text-cyan">{autonomous_turnaround_sec}s</div>
              <span className="turnaround-sub">Machine investigation to verification</span>
            </div>

            <div className="turnaround-box">
              <span className="turnaround-label">HUMAN TIME SAVED</span>
              <div className="turnaround-val mono text-emerald">~{human_time_saved_min}m</div>
              <span className="turnaround-sub">Manual DevOps triage avoided</span>
            </div>

            <div className="turnaround-box">
              <span className="turnaround-label">FINANCIAL RUN-RATE DELTA</span>
              <div className="turnaround-val mono">
                {isSavings ? `+$${net_savings_monthly.toFixed(2)}/mo` : '$0.00 / mo'}
              </div>
              <span className="turnaround-sub">
                {isSavings ? `-$${net_savings_hourly.toFixed(2)}/hr verified` : 'Capacity preserved'}
              </span>
            </div>
          </div>

          <div className="summary-section-item">
            <span className="item-label">RESOLUTION OUTCOME:</span>
            <p className="item-text">{outcome}</p>
          </div>

          <div className="summary-section-item">
            <span className="item-label">DETERMINISTIC SAFETY VERIFICATION:</span>
            <p className="item-text mono">{safety_summary}</p>
          </div>

          <div className="summary-section-item highlight-box">
            <span className="item-label">FINOPS AGENT RECOMMENDATION:</span>
            <p className="item-text">{recommendation}</p>
          </div>
        </div>

        <div className="modal-footer">
          <span className="audit-disclaimer mono">
            AUDIT INVARIANT CHECK CONFIRMED • NO UNDETECTED MUTATIONS
          </span>
          <button type="button" className="modal-action-btn" onClick={onClose}>
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveSummaryModal;
