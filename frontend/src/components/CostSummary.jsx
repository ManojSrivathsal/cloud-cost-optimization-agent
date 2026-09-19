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

  const safeHourlyBurn = Number.isFinite(Number(total_hourly_burn)) ? Number(total_hourly_burn) : 0;
  const safeMonthlySpend = Number.isFinite(Number(projected_monthly_spend)) ? Number(projected_monthly_spend) : safeHourlyBurn * 730;
  const safeSavings = Number.isFinite(Number(savings_realized_monthly)) ? Number(savings_realized_monthly) : 0;
  const safeInstances = total_instances != null ? total_instances : 0;
  const safeServiceCount = service_count != null ? service_count : 0;
  const safeHealth = health_summary || { healthy: 0, warning: 0, degraded: 0 };
  const safeBreakdown = Array.isArray(cost_breakdown) ? cost_breakdown : [];

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
            <span className="kpi-number">{safeMonthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="kpi-unit">/ mo</span>
          </div>
          <div className="kpi-subtext">Calculated from 730h run-rate</div>
        </div>

        {/* KPI 2: Current Hourly Burn */}
        <div className="cost-kpi-card">
          <div className="kpi-label">Current Hourly Burn</div>
          <div className="kpi-value-row">
            <span className="kpi-currency">$</span>
            <span className="kpi-number">{safeHourlyBurn.toFixed(2)}</span>
            <span className="kpi-unit">/ hr</span>
          </div>
          <div className="kpi-subtext">Across {safeServiceCount} active services ({safeInstances} instances)</div>
        </div>

        {/* KPI 3: Realized Savings */}
        <div className="cost-kpi-card highlight-emerald">
          <div className="kpi-label">Agent Realized Savings (MTD)</div>
          <div className="kpi-value-row">
            <span className="kpi-currency text-emerald">+$</span>
            <span className="kpi-number text-emerald">{safeSavings.toFixed(2)}</span>
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
              <span className="pill-count">{safeHealth.healthy ?? 0}</span>
              <span className="pill-label">Healthy</span>
            </div>
            <div className="health-stat-pill warning">
              <span className="pill-dot"></span>
              <span className="pill-count">{safeHealth.warning ?? 0}</span>
              <span className="pill-label">Warning</span>
            </div>
          </div>
          <div className="kpi-subtext">{safeInstances} total provisioned instances</div>
        </div>
      </div>

      {/* Spend Distribution by Service */}
      <div className="spend-breakdown-bar-card">
        <div className="breakdown-header">
          <span className="breakdown-title">Spend Distribution by Service</span>
          <span className="breakdown-total">Total: ${safeHourlyBurn.toFixed(2)}/hr</span>
        </div>

        <div className="progress-stack-bar">
          {safeBreakdown.map((item, idx) => {
            const colors = ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#ec4899'];
            const barColor = colors[idx % colors.length];
            const pct = Number.isFinite(Number(item?.percentage_of_total)) ? Number(item.percentage_of_total).toFixed(1) : '0.0';
            const cost = Number.isFinite(Number(item?.hourly_cost)) ? Number(item.hourly_cost).toFixed(2) : '0.00';
            return (
              <div
                key={item?.service_id || idx}
                className="progress-segment"
                style={{
                  width: `${pct}%`,
                  backgroundColor: barColor,
                }}
                title={`${item?.name || 'Service'}: $${cost}/hr (${pct}%)`}
              />
            );
          })}
        </div>

        <div className="breakdown-legend">
          {safeBreakdown.map((item, idx) => {
            const colors = ['#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#ec4899'];
            const pct = Number.isFinite(Number(item?.percentage_of_total)) ? Number(item.percentage_of_total).toFixed(1) : '0.0';
            const cost = Number.isFinite(Number(item?.hourly_cost)) ? Number(item.hourly_cost).toFixed(2) : '0.00';
            return (
              <div key={item?.service_id || idx} className="legend-item">
                <span className="legend-indicator" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                <span className="legend-name">{item?.name || 'Service'}</span>
                <span className="legend-value">${cost}/hr ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CostSummary;
