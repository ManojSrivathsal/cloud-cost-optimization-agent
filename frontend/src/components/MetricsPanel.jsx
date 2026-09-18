import React from 'react';

function MetricsPanel({ serviceMetrics }) {
  if (!serviceMetrics) {
    return (
      <div className="metrics-panel empty-state">
        <p>No service selected. Click a service from the fleet to view real-time telemetry.</p>
      </div>
    );
  }

  const {
    service_id,
    name,
    instance_type,
    current_instances,
    min_instances,
    max_instances,
    cost_per_hour,
    cpu_utilization,
    memory_utilization,
    traffic_rps,
    latency_ms,
    metrics_history,
    alerts,
  } = serviceMetrics;

  // Helper for pure CSS sparkline rendering
  const renderSparkline = (values, maxVal, unit = '') => {
    if (!values || values.length === 0) return null;
    const computedMax = maxVal || Math.max(...values, 1);

    return (
      <div className="css-sparkline-container" title={`Recent samples: ${values.join(', ')} ${unit}`}>
        {values.map((val, idx) => {
          const heightPercent = Math.min(100, Math.max(12, Math.round((val / computedMax) * 100)));
          return (
            <div key={idx} className="sparkline-bar-wrapper">
              <div
                className="sparkline-bar"
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="metrics-panel">
      <div className="panel-header">
        <div>
          <div className="panel-pretitle">REAL-TIME TELEMETRY</div>
          <h2 className="panel-title">{name}</h2>
          <div className="panel-meta-tags">
            <span className="mono-pill">{service_id}</span>
            <span className="mono-pill">{instance_type}</span>
            <span className="mono-pill highlight">${cost_per_hour.toFixed(2)}/hr</span>
          </div>
        </div>

        <div className="capacity-range-box">
          <div className="capacity-range-label">Capacity Bounds</div>
          <div className="capacity-range-visual">
            <span className="limit-marker min">Min: {min_instances}</span>
            <div className="capacity-bar-track">
              <div
                className="capacity-bar-fill"
                style={{
                  width: `${((current_instances - min_instances) / Math.max(1, max_instances - min_instances)) * 100}%`,
                }}
              />
            </div>
            <span className="limit-marker max">Max: {max_instances}</span>
          </div>
          <div className="current-instances-readout">
            Current: <strong>{current_instances}</strong> instances
          </div>
        </div>
      </div>

      {/* Main Telemetry Quadrant Grid */}
      <div className="telemetry-deepdive-grid">
        {/* Metric 1: CPU Utilization */}
        <div className="metric-gauge-card">
          <div className="metric-header">
            <span className="metric-name">CPU Utilization</span>
            <span className={`metric-badge ${cpu_utilization > 70 ? 'badge-warn' : cpu_utilization < 20 ? 'badge-idle' : 'badge-good'}`}>
              {cpu_utilization < 20 ? 'UNDERUTILIZED' : cpu_utilization > 70 ? 'HIGH LOAD' : 'OPTIMAL'}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-large-number">{cpu_utilization}</span>
            <span className="metric-unit">%</span>
          </div>
          {/* Progress Bar */}
          <div className="metric-progress-track">
            <div
              className={`metric-progress-bar ${cpu_utilization > 70 ? 'bg-warn' : cpu_utilization < 20 ? 'bg-idle' : 'bg-primary'}`}
              style={{ width: `${cpu_utilization}%` }}
            />
          </div>
          {/* Sparkline History */}
          <div className="sparkline-section">
            <span className="sparkline-title">Recent Telemetry (8 samples)</span>
            {renderSparkline(metrics_history?.cpu, 100, '%')}
          </div>
        </div>

        {/* Metric 2: Memory Utilization */}
        <div className="metric-gauge-card">
          <div className="metric-header">
            <span className="metric-name">Memory Utilization</span>
            <span className={`metric-badge ${memory_utilization > 80 ? 'badge-danger' : 'badge-good'}`}>
              {memory_utilization > 80 ? 'ELEVATED' : 'STABLE'}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-large-number">{memory_utilization}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="metric-progress-track">
            <div
              className={`metric-progress-bar ${memory_utilization > 80 ? 'bg-danger' : 'bg-primary'}`}
              style={{ width: `${memory_utilization}%` }}
            />
          </div>
          <div className="sparkline-section">
            <span className="sparkline-title">Recent Telemetry (8 samples)</span>
            {renderSparkline(metrics_history?.memory, 100, '%')}
          </div>
        </div>

        {/* Metric 3: Traffic & RPS */}
        <div className="metric-gauge-card">
          <div className="metric-header">
            <span className="metric-name">Request Rate</span>
            <span className="metric-badge badge-neutral">INGRESS</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-large-number">{traffic_rps}</span>
            <span className="metric-unit">req/sec</span>
          </div>
          <div className="metric-sub-stat">
            Calculated over 60s moving window
          </div>
          <div className="sparkline-section">
            <span className="sparkline-title">Traffic Trend</span>
            {renderSparkline(metrics_history?.traffic, null, 'RPS')}
          </div>
        </div>

        {/* Metric 4: Latency (P95) */}
        <div className="metric-gauge-card">
          <div className="metric-header">
            <span className="metric-name">Latency (p95)</span>
            <span className={`metric-badge ${latency_ms > 100 ? 'badge-danger' : latency_ms > 40 ? 'badge-warn' : 'badge-good'}`}>
              {latency_ms < 40 ? 'EXCELLENT' : latency_ms < 100 ? 'ACCEPTABLE' : 'DEGRADED'}
            </span>
          </div>
          <div className="metric-value-row">
            <span className="metric-large-number">{latency_ms}</span>
            <span className="metric-unit">ms</span>
          </div>
          <div className="metric-sub-stat">
            Target SLA: &lt; 150ms (p95)
          </div>
          <div className="sparkline-section">
            <span className="sparkline-title">Latency Trend</span>
            {renderSparkline(metrics_history?.latency, null, 'ms')}
          </div>
        </div>
      </div>

      {/* Service Telemetry Alerts / Observations */}
      {alerts && alerts.length > 0 && (
        <div className="panel-alerts-callout">
          <div className="callout-header">Active Cloud Watch Observations:</div>
          <ul className="callout-list">
            {alerts.map((alert, idx) => (
              <li key={idx} className="callout-item">{alert}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MetricsPanel;
