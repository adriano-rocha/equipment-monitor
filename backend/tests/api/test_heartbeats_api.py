"""Testes de API (TestClient) — critérios de aceitação AC-01 a AC-07 da
SPEC-001, batendo na rota real POST /api/v1/heartbeats.

AC-06 (atomicidade/rollback) já foi comprovada nos testes de integração
(T07: test_heartbeat_flow_rolls_back_completely_on_failure) — não é
re-testada aqui, porque atomicidade é uma propriedade da camada de
persistência, não do HTTP em si.
"""

import uuid
from datetime import datetime, timezone

from app.domain.device_credential import DeviceCredentialStatus
from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel
from tests.seed_helpers import seed_device_and_credential


def _auth_header(key_id: str, secret: str) -> dict:
    return {"Authorization": f"DeviceKey {key_id}:{secret}"}


# --- AC-01: sucesso ---------------------------------------------------------


def test_ac01_heartbeat_with_valid_credentials_returns_201(client, db_session):
    device_id, _ = seed_device_and_credential(db_session, key_id="key-ac01", secret="s3gredo")

    response = client.post(
        "/api/v1/heartbeats",
        headers=_auth_header("key-ac01", "s3gredo"),
        json={"hostname": "notebook-01", "battery_level": 90},
    )

    assert response.status_code == 201
    assert response.json()["device_id"] == str(device_id)


def test_ac01_empty_body_is_valid(client, db_session):
    seed_device_and_credential(db_session, key_id="key-ac01-vazio", secret="s3gredo")

    response = client.post("/api/v1/heartbeats", headers=_auth_header("key-ac01-vazio", "s3gredo"), json={})

    assert response.status_code == 201


# --- AC-02: last_seen sempre do servidor ------------------------------------


def test_ac02_last_seen_uses_server_time_not_device_timestamp(client, db_session):
    device_id, _ = seed_device_and_credential(db_session, key_id="key-ac02", secret="s3gredo")

    before = datetime.now(timezone.utc)
    response = client.post(
        "/api/v1/heartbeats",
        headers=_auth_header("key-ac02", "s3gredo"),
        json={"device_timestamp": "2000-01-01T00:00:00Z"},
    )
    after = datetime.now(timezone.utc)

    assert response.status_code == 201
    persisted_device = db_session.get(DeviceModel, device_id)
    assert before <= persisted_device.last_seen <= after


# --- AC-03: heartbeat persiste com todos os campos enviados ------------------


def test_ac03_heartbeat_persisted_with_all_sent_fields(client, db_session):
    seed_device_and_credential(db_session, key_id="key-ac03", secret="s3gredo")

    response = client.post(
        "/api/v1/heartbeats",
        headers=_auth_header("key-ac03", "s3gredo"),
        json={
            "hostname": "notebook-ac03",
            "reported_ip": "192.168.1.50",
            "battery_level": 42,
            "metadata": {"os": "windows", "versao": "11"},
        },
    )

    assert response.status_code == 201
    heartbeat_id = uuid.UUID(response.json()["id"])

    persisted = db_session.get(HeartbeatModel, heartbeat_id)
    assert persisted.hostname == "notebook-ac03"
    assert persisted.reported_ip == "192.168.1.50"
    assert persisted.battery_level == 42
    assert persisted.metadata_ == {"os": "windows", "versao": "11"}


# --- AC-04: credencial inválida/revogada/inexistente -> 401 -----------------


def test_ac04_missing_authorization_header_returns_401(client):
    response = client.post("/api/v1/heartbeats", json={})
    assert response.status_code == 401


def test_ac04_unknown_key_id_returns_401_and_persists_nothing(client, db_session):
    response = client.post("/api/v1/heartbeats", headers=_auth_header("key-inexistente", "qualquer"), json={})

    assert response.status_code == 401
    assert db_session.query(HeartbeatModel).count() == 0


def test_ac04_wrong_secret_returns_401(client, db_session):
    seed_device_and_credential(db_session, key_id="key-ac04-secret", secret="s3gredo")

    response = client.post(
        "/api/v1/heartbeats", headers=_auth_header("key-ac04-secret", "secret-errado"), json={}
    )

    assert response.status_code == 401


def test_ac04_revoked_credential_returns_401(client, db_session):
    _, credential_id = seed_device_and_credential(db_session, key_id="key-ac04-revoked", secret="s3gredo")
    credential = db_session.get(DeviceCredentialModel, credential_id)
    credential.status = DeviceCredentialStatus.REVOKED
    db_session.commit()

    response = client.post("/api/v1/heartbeats", headers=_auth_header("key-ac04-revoked", "s3gredo"), json={})

    assert response.status_code == 401


# --- AC-05: payload inválido -> 422, nada persistido/alterado ---------------


def test_ac05_invalid_battery_level_returns_422_and_persists_nothing(client, db_session):
    device_id, _ = seed_device_and_credential(db_session, key_id="key-ac05", secret="s3gredo")

    response = client.post(
        "/api/v1/heartbeats", headers=_auth_header("key-ac05", "s3gredo"), json={"battery_level": 150}
    )

    assert response.status_code == 422
    assert db_session.query(HeartbeatModel).count() == 0
    assert db_session.get(DeviceModel, device_id).last_seen is None


def test_ac05_oversized_metadata_returns_422(client, db_session):
    seed_device_and_credential(db_session, key_id="key-ac05-meta", secret="s3gredo")

    response = client.post(
        "/api/v1/heartbeats",
        headers=_auth_header("key-ac05-meta", "s3gredo"),
        json={"metadata": {"x": "a" * 3000}},
    )

    assert response.status_code == 422