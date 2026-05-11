import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db

SQLALCHEMY_TEST_URL = "postgresql://postgres:postgres@localhost:5432/service_catalog_test"
engine = create_engine(SQLALCHEMY_TEST_URL)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def admin_token(client):
    # Первый админ создаётся вручную в БД, либо через seed.
    # Для примера — предположим, что bootstrap скрипт создал admin/Admin12345
    r = client.post("/users/login",
                    data={"username": "admin", "password": "Admin12345"})
    assert r.status_code == 200
    return r.json()["access_token"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}

def test_register_service(client, admin_token):
    r = client.post("/services/",
                    json={"name": "Payments API", "description": "Billing service"},
                    headers=auth(admin_token))
    assert r.status_code == 201
    assert r.json()["name"] == "Payments API"

def test_duplicate_service(client, admin_token):
    client.post("/services/", json={"name": "Dup", "description": "x"}, headers=auth(admin_token))
    r = client.post("/services/", json={"name": "Dup", "description": "y"}, headers=auth(admin_token))
    assert r.status_code == 409

def test_invalid_ip_validation(client, admin_token):
    r = client.post("/resources/",
                    json={"hostname": "srv01", "ip_address": "127.0.0.1",
                          "cpu_cores": 4, "ram_gb": 8, "disk_gb": 100},
                    headers=auth(admin_token))
    assert r.status_code == 400  # loopback запрещён

def test_endpoint_port_80_forbidden(client, admin_token):
    svc = client.post("/services/", json={"name": "Svc80"}, headers=auth(admin_token)).json()
    r = client.post("/endpoints/",
                    json={"domain": "api.company.com", "port": 80, "service_id": svc["id"]},
                    headers=auth(admin_token))
    assert r.status_code == 400

def test_expired_ssl_rejected(client, admin_token):
    svc = client.post("/services/", json={"name": "SSLsvc"}, headers=auth(admin_token)).json()
    ep = client.post("/endpoints/",
                     json={"domain": "ssl.company.com", "port": 443, "service_id": svc["id"]},
                     headers=auth(admin_token)).json()
    r = client.post("/ssl/",
                    json={"issuer": "LetsEncrypt",
                          "valid_from": "2020-01-01T00:00:00Z",
                          "valid_to": "2021-01-01T00:00:00Z",
                          "endpoint_id": ep["id"]},
                    headers=auth(admin_token))
    assert r.status_code == 400