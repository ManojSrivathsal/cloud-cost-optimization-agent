import React from 'react';

function VerificationPanel({ verificationData, simStage = 'completed' }) {
  if (!verificationData) return null;

  const {
    verification_id,
    service_id,
    verdict,
    verdict_status,
    timestamp,
    summary,
    before_after,
    checks,
  } = verificationData;

  const isAwaiting = simStage === 'idle' || simStage === 'investigating' || simStage === 'safety_checking' || simStage === 'action_dispatch';

  if (isAwaiting) {
    return (
      <div className="verification-panel-card standby-mode">
        <div className="card-header-row">
          <div>
            <div className="panel-eyebrow">POST-ACTION AUDIT</div>
            <h3 className="card-title">State Verification</h3>
          </div>
          <span className="mono-pill">AUDIT: PENDING</span>
        </div>

        <div className="standby-mini-content">
          <span className="standby-icon">🛡️</span>
          <div className="standby-text">
            <div className="standby-subhead">AWAITING CLUSTER EXECUTION</div>
            <p>Post-action invariant verification and state delta audits will commence immediately after execution.</p>
          </div>
        </div>
      </div>
    );
  }

  const isVerified = verdict_status === 'verified';
  const isRecovery = verdict_status === 'recovery_verified';

  return (
    <div className="verification-panel-card">
      <div className="card-header-row">
        <div>
          <div className="panel-eyebrow">POST-ACTION AUDIT</div>
          <h3 className="card-title">State Verification</h3>
        </div>
        <div className="action-meta-tags">
          <span className="mono-pill">Audit ID: {verification_id}</span>
          <span className="mono-pill">Time: {timestamp}</span>
        </div>
      </div>

      <div className="verification-summary-note">
        <span className="note-icon">🛡</span>
        <span className="note-text">{summary}</span>
      </div>

      {/* Before / After State Delta Matrix */}
      <div className="before-after-table-container">
        <div className="table-heading-row">
          <span className="col-metric">TELEMETRY METRIC</span>
          <span className="col-val-header">BEFORE</span>
          <span className="col-val-header">AFTER</span>
        </div>

        <div className="matrix-rows">
          {Object.entries(before_after).map(([key, item]) => {
            const hasChanged = item.before !== item.after;
            return (
              <div key={key} className={`matrix-row ${hasChanged ? 'row-changed' : ''}`}>
                <span className="metric-label">{item.label}</span>
                <span className="metric-before mono">{item.before}</span>
                <span className={`metric-after mono ${hasChanged ? 'val-highlight' : ''}`}>
                  {item.after}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Post-Action Verification Checklist */}
      <div className="verification-checks-box">
        <div className="checks-box-title">Verification Checklist & Invariants:</div>
        <div className="checks-list">
          {checks.map((chk, idx) => (
            <div key={idx} className="check-item-line">
              <span className="check-bullet-icon">✓</span>
              <div className="check-text-group">
                <span className="check-item-name">{chk.name}</span>
                <span className="check-item-detail mono">{chk.detail}</span>
              </div>
              <span className="check-verdict-pill">PASS</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Verdict Footer */}
      <div className="verification-footer">
        <div className="verdict-label-group">
          <span className="verdict-small-title">POST-AUDIT VERDICT</span>
          <div className={`verdict-display-pill ${isVerified ? 'verified-pass' : isRecovery ? 'verified-recovery' : 'verified-stable'}`}>
            <span className="dot">●</span>
            <span>{verdict}</span>
          </div>
        </div>
        <span className="assurance-tag">ZERO INCONSISTENCY CONFIRMED</span>
      </div>
    </div>
  );
}

export default VerificationPanel;
