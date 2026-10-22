"""Testes de API para Eventos, Pontos Físicos e Responsáveis (Etapa 3 / SPEC-006)."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.auth.user_auth_service import UserAuthService
from app.infrastructure.db.models.user_model import UserModel
from tests.database import TestSessionLocal


@pytest.fixture
def auth_headers() -> dict[str, str]:  # type: ignore
    """Cria um coordenador temporário e retorna headers com Bearer Token."""
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


def test_create_and_list_events(client: TestClient, auth_headers: dict[str, str]):
    """Testa criação e listagem de eventos com período válido."""
    now = datetime.now(timezone.utc)
    payload = {
        "name": f"Expo Inovação {uuid4().hex[:4]}",
        "location": "Pavilhão Anhembi",
        "starts_at": (now + timedelta(days=1)).isoformat(),
        "ends_at": (now + timedelta(days=3)).isoformat(),
        "is_active": True,
    }

    create_resp = client.post("/api/v1/events", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201
    event_data = create_resp.json()
    assert event_data["name"] == payload["name"]
    assert event_data["location"] == payload["location"]
    assert event_data["is_active"] is True

    list_resp = client.get("/api/v1/events", headers=auth_headers)
    assert list_resp.status_code == 200
    events = list_resp.json()
    assert any(e["id"] == event_data["id"] for e in events)


def test_assign_device_with_location_point_and_move_point(
    client: TestClient, auth_headers: dict[str, str]
):
    """Testa vínculo com ponto físico, responsável e histórico ao mover de ponto."""
    # 1. Cria equipamento
    dev_resp = client.post(
        "/api/v1/devices",
        json={"asset_number": f"NB-PT-{uuid4().hex[:6]}", "device_type": "notebook"},
        headers=auth_headers,
    )
    assert dev_resp.status_code == 201
    device_id = dev_resp.json()["id"]

    # 2. Cria responsável operacional cadastral (sem senha - Decisão C)
    user_resp = client.post(
        "/api/v1/users",
        json={"name": "Operador Ponto", "email": f"operador_{uuid4().hex[:6]}@teste.com"},
        headers=auth_headers,
    )
    assert user_resp.status_code == 201
    user_id = user_resp.json()["id"]

    # 3. Cria evento
    now = datetime.now(timezone.utc)
    evt_resp = client.post(
        "/api/v1/events",
        json={
            "name": f"Congresso TI {uuid4().hex[:4]}",
            "location": "Centro de Convenções",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=2)).isoformat(),
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert evt_resp.status_code == 201
    event_id = evt_resp.json()["id"]

    # 4. Associa equipamento ao evento no ponto "Entrada VIP" com responsável
    assign_resp = client.post(
        f"/api/v1/events/{event_id}/devices",
        json={
            "device_id": device_id,
            "location_point": "Entrada VIP",
            "assigned_user_id": user_id,
        },
        headers=auth_headers,
    )
    assert assign_resp.status_code == 201
    assoc_1 = assign_resp.json()
    assert assoc_1["location_point"] == "Entrada VIP"
    assert assoc_1["assigned_user_id"] == user_id
    assert assoc_1["is_active"] is True
    assert assoc_1["unassigned_at"] is None

    # 5. Move o equipamento para o ponto "Docas"
    move_resp = client.patch(
        f"/api/v1/events/{event_id}/devices/{device_id}",
        json={"location_point": "Docas"},
        headers=auth_headers,
    )
    assert move_resp.status_code == 200
    assoc_2 = move_resp.json()
    assert assoc_2["id"] != assoc_1["id"]
    assert assoc_2["location_point"] == "Docas"
    assert assoc_2["is_active"] is True

    # 6. Valida que o histórico de auditoria foi rigorosamente preservado
    history_resp = client.get(
        f"/api/v1/events/{event_id}/devices?active_only=false",
        headers=auth_headers,
    )
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) == 2

    encerrado = next(h for h in history if h["id"] == assoc_1["id"])
    assert encerrado["location_point"] == "Entrada VIP"
    assert encerrado["unassigned_at"] is not None
    assert encerrado["is_active"] is False

    ativo = next(h for h in history if h["id"] == assoc_2["id"])
    assert ativo["location_point"] == "Docas"
    assert ativo["unassigned_at"] is None
    assert ativo["is_active"] is True

    # 7. Desvincula o equipamento do evento
    del_resp = client.delete(
        f"/api/v1/events/{event_id}/devices/{device_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["unassigned_at"] is not None

    # Apenas ativos retorna vazio
    active_resp = client.get(
        f"/api/v1/events/{event_id}/devices?active_only=true",
        headers=auth_headers,
    )
    assert active_resp.status_code == 200
    assert len(active_resp.json()) == 0


def test_move_device_between_events_closes_previous_association(
    client: TestClient, auth_headers: dict[str, str]
):
    """Testa que associar um equipamento a um novo evento encerra o vínculo ativo no evento anterior."""
    # Cria equipamento
    dev_resp = client.post(
        "/api/v1/devices",
        json={"asset_number": f"TAB-MIGRATE-{uuid4().hex[:6]}", "device_type": "tablet"},
        headers=auth_headers,
    )
    device_id = dev_resp.json()["id"]

    now = datetime.now(timezone.utc)
    # Evento A
    evt_a = client.post(
        "/api/v1/events",
        json={
            "name": f"Evento A {uuid4().hex[:4]}",
            "location": "Local A",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "is_active": True,
        },
        headers=auth_headers,
    ).json()

    # Evento B
    evt_b = client.post(
        "/api/v1/events",
        json={
            "name": f"Evento B {uuid4().hex[:4]}",
            "location": "Local B",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=1)).isoformat(),
            "is_active": True,
        },
        headers=auth_headers,
    ).json()

    # Associa no Evento A (Ponto Palco)
    assoc_a = client.post(
        f"/api/v1/events/{evt_a['id']}/devices",
        json={"device_id": device_id, "location_point": "Palco"},
        headers=auth_headers,
    ).json()
    assert assoc_a["is_active"] is True

    # Move para o Evento B (Ponto Recepção)
    assoc_b = client.post(
        f"/api/v1/events/{evt_b['id']}/devices",
        json={"device_id": device_id, "location_point": "Recepção"},
        headers=auth_headers,
    ).json()
    assert assoc_b["is_active"] is True

    # Verifica que o vínculo no Evento A foi automaticamente encerrado com unassigned_at
    dev_events_resp = client.get(
        f"/api/v1/devices/{device_id}/events",
        headers=auth_headers,
    )
    assert dev_events_resp.status_code == 200
    all_associations = dev_events_resp.json()

    assoc_a_record = next(a for a in all_associations if a["event_id"] == evt_a["id"])
    assert assoc_a_record["unassigned_at"] is not None
    assert assoc_a_record["is_active"] is False

    assoc_b_record = next(a for a in all_associations if a["event_id"] == evt_b["id"])
    assert assoc_b_record["unassigned_at"] is None
    assert assoc_b_record["is_active"] is True