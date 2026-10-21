from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.auth.user_auth_service import UserAuthService
from app.infrastructure.db.models.user_model import UserModel
from tests.database import TestSessionLocal


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Cria um usuário coordenador temporário e retorna os headers com Bearer Token."""
    session = TestSessionLocal()
    user = UserModel(
        name="Coordenador de Teste",
        email=f"coord-{uuid4().hex}@teste.com",
        password_hash=UserAuthService().hash_password("SenhaForte-123"),
    )
    try:
        session.add(user)
        session.commit()
        session.refresh(user)

        token = UserAuthService().create_access_token(user.id)
        yield {"Authorization": f"Bearer {token}"}
    finally:
        session.rollback()
        existing = session.query(UserModel).filter(UserModel.id == user.id).first()
        if existing is not None:
            session.delete(existing)
            session.commit()
        session.close()


def test_create_device_success(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/v1/devices",
        json={
            "asset_number": "NB-CREATE-001",
            "device_type": "notebook",
            "manufacturer": "Dell",
            "model": "Latitude 3420",
            "serial_number": "SN12345678",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["asset_number"] == "NB-CREATE-001"
    assert data["device_type"] == "notebook"
    assert data["status"] == "SEM REGISTRO"
    assert "credentials" in data
    assert data["credentials"]["key_id"].startswith("key_")
    assert data["credentials"]["secret"].startswith("sec_")


def test_create_device_duplicate_asset_returns_409(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "asset_number": "NB-DUPLICATE-001",
        "device_type": "notebook",
    }
    first_res = client.post("/api/v1/devices", json=payload, headers=auth_headers)
    assert first_res.status_code == 201

    duplicate_res = client.post("/api/v1/devices", json=payload, headers=auth_headers)
    assert duplicate_res.status_code == 409
    assert "já cadastrado" in duplicate_res.json()["detail"]


def test_create_device_without_auth_returns_401(client: TestClient):
    response = client.post(
        "/api/v1/devices",
        json={"asset_number": "NB-NO-AUTH"},
    )
    assert response.status_code == 401


def test_create_device_with_forbidden_fields_returns_422(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/v1/devices",
        json={
            "asset_number": "NB-INVALID-001",
            "hostname": "hacker-pc",  # Proibido no cadastro
            "battery_level": 90,       # Proibido no cadastro
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_created_device_credential_can_authenticate_real_heartbeat(
    client: TestClient, auth_headers: dict[str, str]
):
    # 1. Cria o equipamento via endpoint administrativo
    create_res = client.post(
        "/api/v1/devices",
        json={
            "asset_number": "CEL-P2P-001",
            "device_type": "smartphone",
            "manufacturer": "Samsung",
            "model": "Galaxy S23",
        },
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    body = create_res.json()
    key_id = body["credentials"]["key_id"]
    secret = body["credentials"]["secret"]

    # 2. Usa a credencial retornada para enviar um heartbeat real
    hb_headers = {"Authorization": f"DeviceKey {key_id}:{secret}"}
    hb_payload = {
        "hostname": "galaxy-s23",
        "battery_level": 85,
    }
    hb_res = client.post("/api/v1/heartbeats", json=hb_payload, headers=hb_headers)
    assert hb_res.status_code == 201

    # 3. Consulta a listagem de equipamentos e valida que agora está ONLINE
    list_res = client.get("/api/v1/devices", headers=auth_headers)
    assert list_res.status_code == 200
    devices = list_res.json()
    device = next(d for d in devices if d["asset_number"] == "CEL-P2P-001")
    assert device["status"] == "ONLINE"
    assert device["battery_level"] == 85
    assert device["hostname"] == "galaxy-s23"