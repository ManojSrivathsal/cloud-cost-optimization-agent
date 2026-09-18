import React from 'react';

function SafetyValidation({ safetyData }) {
  if (!safetyData) return null;

  const {
    target_service_id,
    verdict,
    verdict_status,
    policy_id,
    timestamp,
    summary,
    checks,
  } = safetyData;

  const isSafe = verdict_status === 'pass';

  return (
    <section className="safety-validation-section">
      <div className="section-header">
        <div>
          <div className="panel-eyebrow">DETERMINISTIC GUARDRAILS</div>
          <h2 className="section-title">Safety Engine Validation</h2>
        </div>
        <div className="safety-meta-tags">
          <span className="mono-pill">Policy: {policy_id}</span>
          <span className="mono-pill">Audit: {timestamp}</span>
          <span className="mono-pill highlight">Target: {target_service_id}</span>
        </div>
      </div>

      <div className={`safety-verdict-banner ${isSafe ? 'verdict-safe' : 'verdict-blocked'}`}>
        <div className="verdict-status-box">
          <span className="verdict-icon">{isSafe ? '✓' : '✖'}</span>
          <div>
            <div className="verdict-heading">{verdict}</div>
            <div className="verdict-subtext">{summary}</div>
          </div>
        </div>
        <div className="verdict-badge">
          {isSafe ? 'AUTHORIZATION: GRANTED' : 'AUTHORIZATION: BLOCKED'}
        </div>
      </div>

      {/* Safety Checks Grid */}
      <div className="safety-checks-grid">
        {checks.map((check) => {
          const isPass = check.status === 'PASS';
          return (
            <div key={check.id} className={`safety-check-card ${isPass ? 'check-pass' : 'check-blocked'}`}>
              <div className="check-card-header">
                <span className="check-status-icon">{isPass ? '✓' : '✖'}</span>
                <span className="check-name">{check.name}</span>
                <span className={`check-badge ${isPass ? 'badge-pass' : 'badge-blocked'}`}>
                  {check.status}
                </span>
              </div>
              <div className="check-detail-row">
                <span className="check-detail-label">Observed:</span>
                <span className="check-detail-val">{check.observed}</span>
              </div>
              <div className="check-detail-row">
                <span className="check-detail-label">Constraint:</span>
                <span className="check-detail-val mono">{check.rule}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default SafetyValidation;
