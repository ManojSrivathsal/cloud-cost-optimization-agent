import React from 'react';

function MetricsPanel({ serviceMetrics }) {
  if (!serviceMetrics) {
    return (
      <div className="metrics-panel empty-state">
        <p>
          No service selected. Click a service from the fleet to view real-time telemetry.
        </p>
      </div>
    );
  }

  /*
   * App.jsx now passes the real backend telemetry using these fields:
   *
   * cpu_percent
   * memory_percent
   * request_rate
   * latency_ms
   * instances
   * hourly_cost
   * min_instances
   * max_instances
   *
   * Keep this component defensive because backend telemetry can
   * temporarily contain null/missing values.
   */

  const service_id =
    serviceMetrics.service_id || 'unknown';

  const name =
    serviceMetrics.name ||
    service_id;

  const instance_type =
    serviceMetrics.instance_type ||
    'simulated';

  const cost_per_hour = Number.isFinite(Number(serviceMetrics.hourly_cost ?? serviceMetrics.cost_per_hour))
    ? Number(serviceMetrics.hourly_cost ?? serviceMetrics.cost_per_hour)
    : 0;

  const current_instances = Number.isFinite(Number(serviceMetrics.instances ?? serviceMetrics.current_instances))
    ? Number(serviceMetrics.instances ?? serviceMetrics.current_instances)
    : 0;

  const min_instances = Number.isFinite(Number(serviceMetrics.min_instances))
    ? Number(serviceMetrics.min_instances)
    : 0;

  const max_instances = Number.isFinite(Number(serviceMetrics.max_instances))
    ? Number(serviceMetrics.max_instances)
    : Math.max(current_instances, min_instances + 1);

  const cpu_utilization = Number.isFinite(Number(serviceMetrics.cpu_percent ?? serviceMetrics.cpu_utilization))
    ? Number(serviceMetrics.cpu_percent ?? serviceMetrics.cpu_utilization)
    : 0;

  const memory_utilization = Number.isFinite(Number(serviceMetrics.memory_percent ?? serviceMetrics.memory_utilization))
    ? Number(serviceMetrics.memory_percent ?? serviceMetrics.memory_utilization)
    : 0;

  const traffic_rps = Number.isFinite(Number(serviceMetrics.request_rate ?? serviceMetrics.traffic_rps))
    ? Number(serviceMetrics.request_rate ?? serviceMetrics.traffic_rps)
    : 0;

  const latency_ms = Number.isFinite(Number(serviceMetrics.latency_ms))
    ? Number(serviceMetrics.latency_ms)
    : 0;

  const alerts =
    Array.isArray(serviceMetrics.alerts)
      ? serviceMetrics.alerts
      : [];

  const metrics_history =
    serviceMetrics.metrics_history || {};

  /*
   * Keep every numeric value inside safe bounds
   * before using it in CSS.
   */
  const safeCpu = Math.min(
    100,
    Math.max(0, cpu_utilization)
  );

  const safeMemory = Math.min(
    100,
    Math.max(0, memory_utilization)
  );

  const capacityRange =
    Math.max(
      1,
      max_instances - min_instances
    );

  const capacityProgress =
    Math.min(
      100,
      Math.max(
        0,
        ((current_instances - min_instances) /
          capacityRange) *
          100
      )
    );

  // Helper for pure CSS sparkline rendering.
  const renderSparkline = (
    values,
    maxVal,
    unit = ''
  ) => {
    if (
      !Array.isArray(values) ||
      values.length === 0
    ) {
      return (
        <div className="sparkline-empty">
          Live samples available from backend
        </div>
      );
    }

    const numericValues =
      values
        .map(Number)
        .filter(Number.isFinite);

    if (!numericValues.length) {
      return (
        <div className="sparkline-empty">
          No recent samples
        </div>
      );
    }

    const computedMax =
      maxVal ||
      Math.max(
        ...numericValues,
        1
      );

    return (
      <div
        className="css-sparkline-container"
        title={`Recent samples: ${numericValues.join(
          ', '
        )} ${unit}`}
      >
        {numericValues.map(
          (value, index) => {
            const heightPercent =
              Math.min(
                100,
                Math.max(
                  12,
                  Math.round(
                    (value /
                      computedMax) *
                      100
                  )
                )
              );

            return (
              <div
                key={index}
                className="sparkline-bar-wrapper"
              >
                <div
                  className="sparkline-bar"
                  style={{
                    height: `${heightPercent}%`,
                  }}
                />
              </div>
            );
          }
        )}
      </div>
    );
  };

  return (
    <div className="metrics-panel">

      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="panel-header">

        <div>
          <div className="panel-pretitle">
            REAL-TIME TELEMETRY
          </div>

          <h2 className="panel-title">
            {name}
          </h2>

          <div className="panel-meta-tags">

            <span className="mono-pill">
              {service_id}
            </span>

            <span className="mono-pill">
              {instance_type}
            </span>

            <span className="mono-pill highlight">
              ${cost_per_hour.toFixed(2)}/hr
            </span>

          </div>
        </div>

        {/* Capacity bounds */}

        <div className="capacity-range-box">

          <div className="capacity-range-label">
            Capacity Bounds
          </div>

          <div className="capacity-range-visual">

            <span className="limit-marker min">
              Min: {min_instances}
            </span>

            <div className="capacity-bar-track">

              <div
                className="capacity-bar-fill"
                style={{
                  width: `${capacityProgress}%`,
                }}
              />

            </div>

            <span className="limit-marker max">
              Max: {max_instances}
            </span>

          </div>

          <div className="current-instances-readout">
            Current:{' '}
            <strong>
              {current_instances}
            </strong>{' '}
            instances
          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TELEMETRY GRID                                                     */}
      {/* ------------------------------------------------------------------ */}

      <div className="telemetry-deepdive-grid">

        {/* CPU ------------------------------------------------------------ */}

        <div className="metric-gauge-card">

          <div className="metric-header">

            <span className="metric-name">
              CPU Utilization
            </span>

            <span
              className={`metric-badge ${
                cpu_utilization > 70
                  ? 'badge-warn'
                  : cpu_utilization < 20
                    ? 'badge-idle'
                    : 'badge-good'
              }`}
            >
              {cpu_utilization < 20
                ? 'UNDERUTILIZED'
                : cpu_utilization > 70
                  ? 'HIGH LOAD'
                  : 'OPTIMAL'}
            </span>

          </div>

          <div className="metric-value-row">

            <span className="metric-large-number">
              {cpu_utilization}
            </span>

            <span className="metric-unit">
              %
            </span>

          </div>

          <div className="metric-progress-track">

            <div
              className={`metric-progress-bar ${
                cpu_utilization > 70
                  ? 'bg-warn'
                  : cpu_utilization < 20
                    ? 'bg-idle'
                    : 'bg-primary'
              }`}
              style={{
                width: `${safeCpu}%`,
              }}
            />

          </div>

          <div className="sparkline-section">

            <span className="sparkline-title">
              Recent Telemetry
            </span>

            {renderSparkline(
              metrics_history.cpu,
              100,
              '%'
            )}

          </div>

        </div>

        {/* MEMORY --------------------------------------------------------- */}

        <div className="metric-gauge-card">

          <div className="metric-header">

            <span className="metric-name">
              Memory Utilization
            </span>

            <span
              className={`metric-badge ${
                memory_utilization > 80
                  ? 'badge-danger'
                  : 'badge-good'
              }`}
            >
              {memory_utilization > 80
                ? 'ELEVATED'
                : 'STABLE'}
            </span>

          </div>

          <div className="metric-value-row">

            <span className="metric-large-number">
              {memory_utilization}
            </span>

            <span className="metric-unit">
              %
            </span>

          </div>

          <div className="metric-progress-track">

            <div
              className={`metric-progress-bar ${
                memory_utilization > 80
                  ? 'bg-danger'
                  : 'bg-primary'
              }`}
              style={{
                width: `${safeMemory}%`,
              }}
            />

          </div>

          <div className="sparkline-section">

            <span className="sparkline-title">
              Recent Telemetry
            </span>

            {renderSparkline(
              metrics_history.memory,
              100,
              '%'
            )}

          </div>

        </div>

        {/* REQUEST RATE --------------------------------------------------- */}

        <div className="metric-gauge-card">

          <div className="metric-header">

            <span className="metric-name">
              Request Rate
            </span>

            <span className="metric-badge badge-neutral">
              INGRESS
            </span>

          </div>

          <div className="metric-value-row">

            <span className="metric-large-number">
              {traffic_rps}
            </span>

            <span className="metric-unit">
              req/sec
            </span>

          </div>

          <div className="metric-sub-stat">
            Calculated over 60s moving window
          </div>

          <div className="sparkline-section">

            <span className="sparkline-title">
              Traffic Trend
            </span>

            {renderSparkline(
              metrics_history.traffic,
              null,
              'RPS'
            )}

          </div>

        </div>

        {/* LATENCY -------------------------------------------------------- */}

        <div className="metric-gauge-card">

          <div className="metric-header">

            <span className="metric-name">
              Latency (p95)
            </span>

            <span
              className={`metric-badge ${
                latency_ms > 100
                  ? 'badge-danger'
                  : latency_ms > 40
                    ? 'badge-warn'
                    : 'badge-good'
              }`}
            >
              {latency_ms < 40
                ? 'EXCELLENT'
                : latency_ms < 100
                  ? 'ACCEPTABLE'
                  : 'DEGRADED'}
            </span>

          </div>

          <div className="metric-value-row">

            <span className="metric-large-number">
              {latency_ms}
            </span>

            <span className="metric-unit">
              ms
            </span>

          </div>

          <div className="metric-sub-stat">
            Target SLA: &lt; 150ms (p95)
          </div>

          <div className="sparkline-section">

            <span className="sparkline-title">
              Latency Trend
            </span>

            {renderSparkline(
              metrics_history.latency,
              null,
              'ms'
            )}

          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ALERTS                                                             */}
      {/* ------------------------------------------------------------------ */}

      {alerts.length > 0 && (
        <div className="panel-alerts-callout">

          <div className="callout-header">
            Active Cloud Watch Observations:
          </div>

          <ul className="callout-list">

            {alerts.map(
              (alert, index) => (
                <li
                  key={index}
                  className="callout-item"
                >
                  {typeof alert === 'string'
                    ? alert
                    : alert?.message ||
                      alert?.description ||
                      JSON.stringify(alert)}
                </li>
              )
            )}

          </ul>

        </div>
      )}

    </div>
  );
}

export default MetricsPanel;