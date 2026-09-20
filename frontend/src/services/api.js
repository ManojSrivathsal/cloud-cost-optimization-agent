const API_BASE_URL = 'http://127.0.0.1:8000/api';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data?.detail || data?.message || `HTTP ${response.status}`;

    throw new Error(`Backend request failed (${response.status}): ${message}`);
  }

  return data;
}

export const api = {
  // Backend health
  getHealth() {
    return request('/health');
  },

  // Fleet
  getServices() {
    return request('/services');
  },

  getService(serviceId) {
    return request(`/services/${serviceId}`);
  },

  // Live telemetry
  getServiceMetrics(serviceId) {
    return request(`/services/${serviceId}/metrics`);
  },

  getServiceTraffic(serviceId) {
    return request(`/services/${serviceId}/traffic`);
  },

  getServiceHealth(serviceId) {
    return request(`/services/${serviceId}/health`);
  },

  getServiceCost(serviceId) {
    return request(`/services/${serviceId}/cost`);
  },

  getServiceConstraints(serviceId) {
    return request(`/services/${serviceId}/constraints`);
  },

  getStaleObservation(serviceId) {
    return request(`/services/${serviceId}/stale-observation`);
  },

  // Actions
  submitAction(action) {
    return request('/actions', {
      method: 'POST',
      body: JSON.stringify(action),
    });
  },

  getAction(actionId) {
    return request(`/actions/${actionId}`);
  },

  verifyAction(actionId) {
    return request(`/actions/${actionId}/verify`);
  },

  // Official backend scenarios
  runScenario(scenarioName) {
    return request(`/scenarios/${scenarioName}`, {
      method: 'POST',
    });
  },

  // Reset simulator
  reset() {
    return request('/reset', {
      method: 'POST',
    });
  },
};