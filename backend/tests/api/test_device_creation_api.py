"""Testes de API para criação, edição e exclusão de equipamentos (SPEC-010)."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.auth.user_auth_service import UserAuthService
from app.infrastructure.db.models.user_model import UserModel
from tests.database import TestSessionLocal


@pytest.fixture
def auth_headers() -> dict[str, str]: # type: ignore
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


def test_create_device_accepts_custom_type(client: TestClient, auth_headers: dict[str, str]):
    custom_type = "Monitor ultrawide profissional 4K HDR"
    response = client.post(
        "/api/v1/devices",
        json={"asset_number": "MON-CUSTOM-001", "device_type": custom_type},
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["device_type"] == custom_type


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

    from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
    from app.infrastructure.db.models.device_model import DeviceModel
    s = TestSessionLocal()
    print(">>> DEVS NO BANCO:", [(d.asset_number, d.id) for d in s.query(DeviceModel).all()])
    print(">>> CREDS NO BANCO:", [(c.key_id, c.device_id) for c in s.query(DeviceCredentialModel).all()])
    s.close()

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


def test_update_device_success(client: TestClient, auth_headers: dict[str, str]):
    # Cria
    create_res = client.post(
        "/api/v1/devices",
        json={"asset_number": "NB-UPDATE-001", "device_type": "notebook"},
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    device_id = create_res.json()["id"]

    # Atualiza (inclusive patrimônio - Decisão F)
    patch_res = client.patch(
        f"/api/v1/devices/{device_id}",
        json={
            "asset_number": "NB-UPDATE-RENAMED",
            "device_type": "Fone JBL",
            "manufacturer": "Lenovo",
            "operational_state": "RECOLHIDO",
        },
        headers=auth_headers,
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["asset_number"] == "NB-UPDATE-RENAMED"
    assert data["device_type"] == "Fone JBL"
    assert data["manufacturer"] == "Lenovo"
    assert data["operational_state"] == "RECOLHIDO"


def test_put_device_updates_operational_state(
    client: TestClient, auth_headers: dict[str, str]
):
    create_res = client.post(
        "/api/v1/devices",
        json={"asset_number": f"NB-PUT-{uuid4().hex[:8]}"},
        headers=auth_headers,
    )
    assert create_res.status_code == 201

    response = client.put(
        f"/api/v1/devices/{create_res.json()['id']}",
        json={"operational_state": "EM_MANUTENCAO"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["operational_state"] == "EM_MANUTENCAO"


def test_update_device_duplicate_asset_returns_409(client: TestClient, auth_headers: dict[str, str]):
    client.post("/api/v1/devices", json={"asset_number": "NB-ORIGINAL-A"}, headers=auth_headers)
    dev_b = client.post("/api/v1/devices", json={"asset_number": "NB-ORIGINAL-B"}, headers=auth_headers).json()

    # Tenta renomear B com o patrimônio de A
    patch_res = client.patch(
        f"/api/v1/devices/{dev_b['id']}",
        json={"asset_number": "NB-ORIGINAL-A"},
        headers=auth_headers,
    )
    assert patch_res.status_code == 409


def test_delete_device_soft_delete_and_revokes_heartbeat(client: TestClient, auth_headers: dict[str, str]):
    # 1. Cria equipamento e obtém credencial
    create_res = client.post(
        "/api/v1/devices",
        json={"asset_number": "NB-TO-DELETE-001"},
        headers=auth_headers,
    )
    assert create_res.status_code == 201
    body = create_res.json()
    device_id = body["id"]
    key_id = body["credentials"]["key_id"]
    secret = body["credentials"]["secret"]

    # 2. Exclui o equipamento via DELETE (204)
    del_res = client.delete(f"/api/v1/devices/{device_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # 3. Equipamento não aparece mais na lista
    list_res = client.get("/api/v1/devices", headers=auth_headers)
    assert not any(d["id"] == device_id for d in list_res.json())

    # 4. Tentar excluir novamente retorna 404
    del_again = client.delete(f"/api/v1/devices/{device_id}", headers=auth_headers)
    assert del_again.status_code == 404

    # 5. Heartbeat enviado com a credencial do equipamento excluído é REJEITADO (401)
    hb_res = client.post(
        "/api/v1/heartbeats",
        json={"hostname": "excluido"},
        headers={"Authorization": f"DeviceKey {key_id}:{secret}"},
    )
    assert hb_res.status_code == 401


def test_undo_checkin_reactivates_device_by_exact_asset_number(
    client: TestClient, auth_headers: dict[str, str]
):
    asset_number = f"UNDO-EXACT-{uuid4().hex[-4:]}"
    create_res = client.post(
        "/api/v1/devices",
        json={"asset_number": asset_number},
        headers=auth_headers,
    )
    assert create_res.status_code == 201

    checkin_res = client.post(
        "/api/v1/devices/checkin",
        json={"asset_code": asset_number},
        headers=auth_headers,
    )
    assert checkin_res.status_code == 200
    assert checkin_res.json()["operational_state"] == "RECOLHIDO"

    undo_res = client.post(
        "/api/v1/devices/undo-checkin",
        json={"query": asset_number},
        headers=auth_headers,
    )

    assert undo_res.status_code == 200
    assert undo_res.json()["operational_state"] == "ATIVO"
    assert undo_res.json()["asset_number"] == asset_number
    assert undo_res.json()["id"] == create_res.json()["id"]
    assert "status" in undo_res.json()

    uuid_query_res = client.post(
        "/api/v1/devices/undo-checkin",
        json={"query": create_res.json()["id"]},
        headers=auth_headers,
    )
    assert uuid_query_res.status_code == 200
    assert uuid_query_res.json()["id"] == create_res.json()["id"]

    list_res = client.get("/api/v1/devices", headers=auth_headers)
    device = next(item for item in list_res.json() if item["asset_number"] == asset_number)
    assert device["operational_state"] == "ATIVO"


def test_undo_checkin_supports_asset_suffix(
    client: TestClient, auth_headers: dict[str, str]
):
    asset_number = f"UNDO-SUFFIX-{uuid4().hex[-4:]}"
    create_res = client.post(
        "/api/v1/devices",
        json={"asset_number": asset_number},
        headers=auth_headers,
    )
    assert create_res.status_code == 201

    checkin_res = client.post(
        "/api/v1/devices/checkin",
        json={"asset_code": asset_number},
        headers=auth_headers,
    )
    assert checkin_res.status_code == 200

    undo_res = client.post(
        "/api/v1/devices/undo-checkin",
        json={"query": asset_number[-4:]},
        headers=auth_headers,
    )

    assert undo_res.status_code == 200
    assert undo_res.json()["asset_number"] == asset_number
    assert undo_res.json()["operational_state"] == "ATIVO"

    device_id_res = client.post(
        "/api/v1/devices/undo-checkin",
        json={"device_id": create_res.json()["id"]},
        headers=auth_headers,
    )
    assert device_id_res.status_code == 200
    assert device_id_res.json()["id"] == create_res.json()["id"]


def test_undo_checkin_returns_404_for_unknown_device(
    client: TestClient, auth_headers: dict[str, str]
):
    response = client.post(
        "/api/v1/devices/undo-checkin",
        json={"query": f"UNDO-MISSING-{uuid4().hex}"},
        headers=auth_headers,
    )

    assert response.status_code == 404


def test_undo_checkin_requires_query_or_device_id(
    client: TestClient, auth_headers: dict[str, str]
):
    response = client.post(
        "/api/v1/devices/undo-checkin",
        json={},
        headers=auth_headers,
    )

    assert response.status_code == 422