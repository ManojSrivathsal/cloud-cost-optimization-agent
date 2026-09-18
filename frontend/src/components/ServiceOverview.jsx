import React from 'react';
import ServiceCard from './ServiceCard';

function ServiceOverview({ services, selectedServiceId, onSelectService }) {
  return (
    <section className="service-overview-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Active Service Fleet</h2>
          <p className="section-subtitle">
            Select a service to inspect live resource telemetry and safety constraints
          </p>
        </div>
        <div className="fleet-counter-tag">
          {services.length} SERVICES MONITORED
        </div>
      </div>

      <div className="services-grid">
        {services.map((service) => (
          <ServiceCard
            key={service.service_id}
            service={service}
            isSelected={service.service_id === selectedServiceId}
            onSelect={onSelectService}
          />
        ))}
      </div>
    </section>
  );
}

export default ServiceOverview;
