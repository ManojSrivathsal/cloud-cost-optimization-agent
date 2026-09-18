import React from 'react';

function CostSummary({ costData }) {
  if (!costData) return null;

  const {
    total_hourly_burn,
    projected_monthly_spend,
    savings_realized_monthly,
    total_instances,
    service_count,
    health_summary,
    cost_breakdown,
  } = costData;

  return (
    <section className="cost-summary-container">
      <div className="section-header">
        <h2 className="section-title">FinOps Cloud Spend Overview</h2>
        <span className="section-meta-tag">LIVE TELEMETRY AGGREGATION</span>
      </div>

      <div className="cost-kpi-grid">
        {/* KPI 1: Projected Monthly Spend */}
        <div className="cost-kpi-card highlight-primary">
          <div className="kpi-label">Projected Monthly Spend</div>
          <div className="kpi-value-row">
            <span className="kpi-currency">$</span>
            <span className="kpi-number">{projected_monthly_spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="kpi-unit">/ mo</span>
          </div>
          <div className="kpi-subtext">Calculated from 730h run-rate</div>
        </div>

        {/* KPI 2: Current Hourly Burn */}
        <div className="cost-kpi-card">
          <div className="kpi-label">Current Hourly Burn</div>
          <div className="kpi-value-row">
            <span className="kpi-currency">$</span>
            <span className="kpi-number">{total_hourly_burn.toFixed(2)}</span>
            <span className="kpi-unit">/ hr</span>
          </div>
          <div className="kpi-subtext">Across {service_count} active services ({total_instances} instances)</div>
        </div>

        {/* KPI 3: Realized Savings */}
        <div className="cost-kpi-card highlight-emerald">
          <div className="kpi-label">Agent Realized Savings (MTD)</div>
          <div className="kpi-value-row">
            <span className="kpi-currency text-emerald">+$</span>
            <span className="kpi-number text-emerald">{savings_realized_monthly.toFixed(2)}</span>
            <span className="kpi-unit text-emerald">/ mo</span>
          </div>
          <div className="kpi-subtext">Prior autonomous optimizations</div>
        </div>

        {/* KPI 4: Service Fleet Health */}
        <div className="cost-kpi-card">
          <div className="kpi-label">Monitored Fleet Health</div>
          <div className="fleet-health-stats">
            <div className="health-stat-pill healthy">
              <span className="pill-dot"></span>
              <span className="pill-count">{health_summary.healthy}</span>
              <span className="pill-label">Healthy</span>
            </div>
            <div className="health-stat-pill warning">
              <span className="pill-dot"></span>
              <span className="pill-count">{health_summary.warning}</span>
              <span className="pill-label">Warning</span>
            </div>
          </div>
          <div className="kpi-subtext">{total_instances} total provisioned vCPUs</div>
        </div>
      </div>

      {/* Spend Distribution by Service */}
      <div className="spend-breakdown-bar-card">
        <div className="breakdown-header">
          <span className="breakdown-title">Spend Distribution by Service</span>
          <span className="breakdown-total">Total: ${total_hourly_burn.toFixed(2)}/hr</span>
        </div>

        <div className="progress-stack-bar">
          {cost_breakdown.map((item, idx) => {
            const colors = ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#ec4899'];
            const barColor = colors[idx % colors.length];
            return (
              <div
                key={item.service_id}
                className="progress-segment"
                style={{
                  width: `${item.percentage_of_total}%`,
                  backgroundColor: barColor,
                }}
                title={`${item.name}: $${item.hourly_cost}/hr (${item.percentage_of_total}%)`}
              />
            );
          })}
        </div>

        <div className="breakdown-legend">
          {cost_breakdown.map((item, idx) => {
            const colors = ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#ec4899'];
            return (
              <div key={item.service_id} className="legend-item">
                <span className="legend-indicator" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                <span className="legend-name">{item.name}</span>
                <span className="legend-value">${item.hourly_cost}/hr ({item.percentage_of_total}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CostSummary;
