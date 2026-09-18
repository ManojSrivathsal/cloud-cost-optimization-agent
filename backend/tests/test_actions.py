from fastapi.testclient import TestClient


def test_execute_valid_action_and_verify(client: TestClient):
    # Scenario A: Scale down idle reports-worker from 4 to 1
    payload = {
        "service_id": "reports-worker",
        "action": "scale_down",
        "target_instances": 1,
        "reason": "Service is idle with zero traffic.",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["service_id"] == "reports-worker"
    assert data["previous_instances"] == 4
    assert data["new_instances"] == 1
    action_id = data["action_id"]

    # Verify action
    verify_resp = client.get(f"/api/actions/{action_id}/verify")
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["action_id"] == action_id
    assert v_data["verified"] is True
    assert v_data["current_instances"] == 1
    assert v_data["target_instances"] == 1
    assert v_data["previous_instances"] == 4
    assert v_data["cost_before"] > v_data["cost_after"]
    assert v_data["estimated_hourly_savings"] > 0

    # Confirm service state was updated
    svc_resp = client.get("/api/services/reports-worker")
    assert svc_resp.status_code == 200
    assert svc_resp.json()["instances"] == 1


def test_reject_action_below_minimum_instances(client: TestClient):
    payload = {
        "service_id": "reports-worker",
        "action": "scale_down",
        "target_instances": 0,  # Below min (1)
        "reason": "Shutdown completely",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert "below configured minimum" in data["reason"].lower() or "greater than 0" in data["reason"].lower()
    assert len(data["safety_violations"]) > 0
    action_id = data["action_id"]

    # Verification of rejection
    verify_resp = client.get(f"/api/actions/{action_id}/verify")
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["verified"] is True
    assert v_data["status"] == "rejected"
    assert v_data["current_instances"] == 4  # Unchanged!


def test_reject_action_above_maximum_instances(client: TestClient):
    payload = {
        "service_id": "reports-worker",
        "action": "scale_up",
        "target_instances": 15,  # Above max (10)
        "reason": "Massive scale up",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert "exceeds configured maximum" in data["reason"].lower()


def test_reject_scale_down_on_rising_traffic(client: TestClient):
    # auth-api has rising traffic and 78%+ CPU
    payload = {
        "service_id": "auth-api",
        "action": "scale_down",
        "target_instances": 2,
        "reason": "Cost reduction test",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert "rising" in data["reason"].lower() or "cpu" in data["reason"].lower() or "latency" in data["reason"].lower()

    # State untouched
    svc = client.get("/api/services/auth-api").json()
    assert svc["instances"] == 3


def test_simulated_failed_action_preserves_consistent_state(client: TestClient):
    # Switch to Scenario D (simulates cloud provider failure on payment-processor)
    switch_resp = client.post("/api/scenarios/scenario_d")
    assert switch_resp.status_code == 200

    payload = {
        "service_id": "payment-processor",
        "action": "scale_up",
        "target_instances": 4,
        "reason": "Preparing for flash sale",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "capacity" in data["execution_error"].lower() or "unavailable" in data["execution_error"].lower()
    action_id = data["action_id"]

    # Verify state consistency
    verify_resp = client.get(f"/api/actions/{action_id}/verify")
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["verified"] is True
    assert v_data["status"] == "failed"
    assert v_data["current_instances"] == 2  # State NOT altered!


def test_action_on_unknown_service_returns_404(client: TestClient):
    payload = {
        "service_id": "ghost-service",
        "action": "scale_down",
        "target_instances": 1,
        "reason": "Fake",
    }
    response = client.post("/api/actions", json=payload)
    assert response.status_code == 404
    assert "not exist" in response.json()["detail"].lower()


def test_get_action_history_and_detail(client: TestClient):
    # Perform one action
    client.post(
        "/api/actions",
        json={
            "service_id": "reports-worker",
            "action": "scale_down",
            "target_instances": 2,
            "reason": "Scale down step",
        },
    )
    # Check listing
    res = client.get("/api/actions")
    assert res.status_code == 200
    actions = res.json()["actions"]
    assert len(actions) >= 1
    action_id = actions[0]["action_id"]

    # Check detail
    detail = client.get(f"/api/actions/{action_id}")
    assert detail.status_code == 200
    assert detail.json()["action_id"] == action_id
