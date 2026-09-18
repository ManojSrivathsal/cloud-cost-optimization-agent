from fastapi.testclient import TestClient


def test_scenario_a_cost_optimization(client: TestClient):
    resp = client.post("/api/scenarios/scenario_a")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scenario"] == "scenario_a"

    # reports-worker is idle
    svc = client.get("/api/services/reports-worker").json()
    assert svc["request_rate"] == 0.0
    assert svc["instances"] == 4


def test_scenario_b_rising_traffic_safety_block(client: TestClient):
    resp = client.post("/api/scenarios/scenario_b")
    assert resp.status_code == 200

    # auth-api is surging
    svc = client.get("/api/services/auth-api").json()
    assert svc["traffic_trend"] == "rising"
    assert svc["latency_ms"] >= 300.0

    # Safety engine must block scale-down
    action_resp = client.post(
        "/api/actions",
        json={
            "service_id": "auth-api",
            "action": "scale_down",
            "target_instances": 2,
            "reason": "Dangerous scale down attempt during peak traffic",
        },
    )
    assert action_resp.status_code == 200
    assert action_resp.json()["status"] == "rejected"


def test_scenario_c_stale_observation(client: TestClient):
    resp = client.post("/api/scenarios/scenario_c")
    assert resp.status_code == 200

    stale_resp = client.get("/api/services/analytics-pipeline/stale-observation")
    assert stale_resp.status_code == 200
    data = stale_resp.json()
    assert data["is_stale"] is True
    # Stale request rate is low (15 RPS) while live is high (550 RPS)
    assert data["stale_metrics"]["request_rate"] < data["current_metrics"]["request_rate"]


def test_scenario_d_failed_action(client: TestClient):
    resp = client.post("/api/scenarios/scenario_d")
    assert resp.status_code == 200

    svc = client.get("/api/services/payment-processor").json()
    assert svc["failure_simulation_enabled"] is True


def test_invalid_scenario_returns_400(client: TestClient):
    resp = client.post("/api/scenarios/scenario_invalid_xyz")
    assert resp.status_code == 400
    assert "invalid scenario" in resp.json()["detail"].lower()


def test_reset_simulator(client: TestClient):
    # Alter state
    client.post(
        "/api/actions",
        json={
            "service_id": "reports-worker",
            "action": "scale_down",
            "target_instances": 1,
            "reason": "Reduce to 1",
        },
    )
    assert client.get("/api/services/reports-worker").json()["instances"] == 1

    # Reset
    reset_resp = client.post("/api/reset")
    assert reset_resp.status_code == 200

    # Back to 4
    assert client.get("/api/services/reports-worker").json()["instances"] == 4
