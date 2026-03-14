import pytest

from backend.app import app


@pytest.fixture
def client():
    app.testing = True
    with app.test_client() as c:
        yield c


def test_health_endpoint(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data is not None
    assert data.get('status') == 'ok'
