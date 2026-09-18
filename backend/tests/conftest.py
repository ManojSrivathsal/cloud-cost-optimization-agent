import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.simulator.cloud import simulator


@pytest.fixture(autouse=True)
def reset_cloud_state():
    """Ensure every test runs against a clean baseline simulator state."""
    simulator.reset()
    yield
    simulator.reset()


@pytest.fixture
def client():
    return TestClient(app)
