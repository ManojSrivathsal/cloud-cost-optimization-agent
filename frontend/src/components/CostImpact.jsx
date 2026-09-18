import React from 'react';

function CostImpact({ costImpactData, simStage = 'completed' }) {
  if (!costImpactData) return null;

  const {
    service_id,
    previous_hourly_cost,
    new_hourly_cost,
    hourly_delta,
    previous_monthly_spend,
    new_monthly_spend,
    estimated_monthly_savings,
    verified_status,
    status_type,
    summary,
  } = costImpactData;

  const isAwaiting = simStage !== 'completed';

  if (isAwaiting) {
    return (
      <div className="cost-impact-container standby-mode">
        <div className="section-header">
          <div>
            <div className="panel-eyebrow">FINANCIAL IMPACT & ROI</div>
            <h2 className="section-title">Cost Impact Analysis</h2>
          </div>
          <span className="mono-pill">CALCULATION: STANDBY</span>
        </div>

        <div className="standby-mini-content">
          <span className="standby-icon">💰</span>
          <div className="standby-text">
            <div className="standby-subhead">FINANCIAL ROI LOCKED UNTIL AUDIT COMPLETION</div>
            <p>Net hourly burn reductions and verified monthly savings are finalized once post-action invariants pass.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasSavings = estimated_monthly_savings > 0;

  return (
    <div className="cost-impact-container">
      <div className="section-header">
        <div>
          <div className="panel-eyebrow">FINANCIAL IMPACT & ROI</div>
          <h2 className="section-title">Cost Impact Analysis</h2>
        </div>
        <div className="impact-header-tags">
          <span className="mono-pill">Scope: {service_id}</span>
          <span className="mono-pill highlight">Run-rate: 730 hrs/mo</span>
        </div>
      </div>

      <div className="cost-impact-grid">
        {/* Card 1: Before State */}
        <div className="impact-card before-card">
          <div className="impact-card-label">PRE-ACTION SPEND</div>
          <div className="cost-large-row">
            <span className="currency">$</span>
            <span className="amount mono">{previous_hourly_cost.toFixed(2)}</span>
            <span className="unit">/ hr</span>
          </div>
          <div className="monthly-projection-subtext mono">
            ${previous_monthly_spend.toFixed(2)} / month
          </div>
          <div className="impact-note">Initial provisioned allocation</div>
        </div>

        {/* Card 2: After State */}
        <div className="impact-card after-card">
          <div className="impact-card-label">POST-ACTION SPEND</div>
          <div className="cost-large-row">
            <span className="currency">$</span>
            <span className="amount mono">{new_hourly_cost.toFixed(2)}</span>
            <span className="unit">/ hr</span>
          </div>
          <div className="monthly-projection-subtext mono">
            ${new_monthly_spend.toFixed(2)} / month
          </div>
          <div className="impact-note">Current post-audit run rate</div>
        </div>

        {/* Card 3: Hourly Delta */}
        <div className="impact-card delta-card">
          <div className="impact-card-label">HOURLY NET DELTA</div>
          <div className="cost-large-row">
            <span className={`amount mono ${hourly_delta < 0 ? 'text-emerald' : 'text-secondary'}`}>
              {hourly_delta < 0 ? `-$${Math.abs(hourly_delta).toFixed(2)}` : `$${hourly_delta.toFixed(2)}`}
            </span>
            <span className="unit">/ hr</span>
          </div>
          <div className="monthly-projection-subtext">
            {hourly_delta < 0 ? 'Cost reduction rate' : 'No cost expansion'}
          </div>
          <div className="impact-note">Immediate burn difference</div>
        </div>

        {/* Card 4: Verified Monthly Savings / ROI (Primary Hierarchy) */}
        <div className={`impact-card hero-savings-card ${hasSavings ? 'card-savings-positive' : 'card-savings-neutral'}`}>
          <div className="savings-hero-label">
            {hasSavings ? 'VERIFIED MONTHLY SAVINGS' : 'BUDGET PRESERVATION STATUS'}
          </div>
          <div className="savings-hero-number-row">
            {hasSavings ? (
              <>
                <span className="hero-plus text-emerald">+</span>
                <span className="hero-currency text-emerald">$</span>
                <span className="hero-amount mono text-emerald">
                  {estimated_monthly_savings.toFixed(2)}
                </span>
                <span className="hero-unit text-emerald">/ mo</span>
              </>
            ) : (
              <span className="hero-neutral-text mono">$0.00 / mo</span>
            )}
          </div>
          <div className="savings-status-badge">
            <span className="status-indicator-dot">●</span>
            <span className="status-text-val">{verified_status}</span>
          </div>
        </div>
      </div>

      <div className="cost-impact-summary-footer">
        <span className="summary-icon">💡</span>
        <span className="summary-text">{summary}</span>
      </div>
    </div>
  );
}

export default CostImpact;
