import React from 'react';

function ServiceCard({ service, isSelected, onSelect }) {
  const {
    service_id,
    name,
    health,
    status_label,
    current_instances,
    min_instances,
    max_instances,
    cost_per_hour,
    instance_type,
    cpu_utilization,
    memory_utilization,
    traffic_rps,
    latency_ms,
    alerts,
  } = service;

  const isHealthy = health === 'healthy';

  return (
    <div
      className={`service-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(service_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(service_id);
        }
      }}
    >
      <div className="service-card-header">
        <div className="service-identity">
          <div className="service-name-row">
            <h3 className="service-name">{name}</h3>
            {isSelected && <span className="active-badge">SELECTED</span>}
          </div>
          <div className="service-meta-row">
            <span className="service-id-tag">{service_id}</span>
            <span className="instance-type-tag">{instance_type}</span>
          </div>
        </div>

        <div className="service-cost-badge">
          <span className="cost-rate">${cost_per_hour.toFixed(2)}</span>
          <span className="cost-unit">/ hr</span>
        </div>
      </div>

      <div className="service-status-bar">
        <div className={`status-indicator-pill ${health}`}>
          <span className="status-ping"></span>
          <span className="status-text">{status_label || health.toUpperCase()}</span>
        </div>
        <div className="capacity-badge">
          <span className="instances-val">{current_instances}</span> instances
          <span className="capacity-limits">[{min_instances} - {max_instances}]</span>
        </div>
      </div>

      {/* Mini Telemetry Quick-Look Grid */}
      <div className="card-telemetry-grid">
        <div className="telemetry-mini-box">
          <span className="mini-label">CPU</span>
          <span className={`mini-val ${cpu_utilization > 70 ? 'val-high' : cpu_utilization < 20 ? 'val-low' : 'val-normal'}`}>
            {cpu_utilization}%
          </span>
        </div>

        <div className="telemetry-mini-box">
          <span className="mini-label">MEM</span>
          <span className={`mini-val ${memory_utilization > 80 ? 'val-high' : 'val-normal'}`}>
            {memory_utilization}%
          </span>
        </div>

        <div className="telemetry-mini-box">
          <span className="mini-label">RPS</span>
          <span className="mini-val val-normal">{traffic_rps}</span>
        </div>

        <div className="telemetry-mini-box">
          <span className="mini-label">P95</span>
          <span className={`mini-val ${latency_ms > 80 ? 'val-high' : 'val-normal'}`}>
            {latency_ms}ms
          </span>
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="service-card-alert">
          <span className="alert-icon">⚠</span>
          <span className="alert-text">{alerts[0]}</span>
        </div>
      )}
    </div>
  );
}

export default ServiceCard;
