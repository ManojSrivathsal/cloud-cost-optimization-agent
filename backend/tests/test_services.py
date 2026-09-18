from fastapi.testclient import TestClient


def test_list_services(client: TestClient):
    response = client.get("/api/services")
    assert response.status_code == 200
    data = response.json()
    assert "services" in data
    services = data["services"]
    assert len(services) >= 4

    service_ids = [s["service_id"] for s in services]
    assert "reports-worker" in service_ids
    assert "auth-api" in service_ids
    assert "analytics-pipeline" in service_ids
    assert "payment-processor" in service_ids


def test_get_service_detail(client: TestClient):
    response = client.get("/api/services/reports-worker")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "reports-worker"
    assert data["name"] == "Reports Worker"
    assert data["instances"] == 4
    assert data["min_instances"] == 1
    assert data["max_instances"] == 10
    assert "recent_events" in data


def test_get_service_metrics(client: TestClient):
    response = client.get("/api/services/reports-worker/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "reports-worker"
    assert "cpu_percent" in data
    assert "memory_percent" in data
    assert "request_rate" in data
    assert "latency_ms" in data
    assert "observed_at" in data
    assert data["request_rate"] == 0.0


def test_get_service_traffic(client: TestClient):
    response = client.get("/api/services/auth-api/traffic")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "auth-api"
    assert data["traffic_trend"] == "rising"
    assert data["request_rate"] >= 800.0


def test_get_service_health(client: TestClient):
    response = client.get("/api/services/reports-worker/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "reports-worker"
    assert data["health"] == "healthy"
    assert data["checks_passing"] == data["checks_total"]


def test_get_service_cost(client: TestClient):
    response = client.get("/api/services/reports-worker/cost")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "reports-worker"
    assert data["instances"] == 4
    assert data["hourly_cost"] == round(4 * 1.05, 2)
    assert data["daily_projected_cost"] == round(data["hourly_cost"] * 24, 2)
    assert data["is_simulated"] is True


def test_get_service_constraints(client: TestClient):
    response = client.get("/api/services/reports-worker/constraints")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "reports-worker"
    assert data["min_instances"] == 1
    assert data["max_instances"] == 10
    assert data["max_latency_threshold_ms"] == 250.0


def test_get_stale_observation(client: TestClient):
    response = client.get("/api/services/analytics-pipeline/stale-observation")
    assert response.status_code == 200
    data = response.json()
    assert data["service_id"] == "analytics-pipeline"
    assert data["is_stale"] is True
    assert "stale_metrics" in data
    assert "current_metrics" in data
    assert data["time_delta_seconds"] > 1000  # 45 minutes ~ 2700s


def test_service_not_found(client: TestClient):
    response = client.get("/api/services/non-existent-service")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
