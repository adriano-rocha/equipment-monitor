"""Testes da autenticação JWT e proteção dos endpoints."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.auth.user_auth_service import UserAuthService
from app.infrastructure.db.models.user_model import UserModel
from tests.database import TestSessionLocal


@pytest.fixture
def authenticated_user():
    """Cria um usuário de teste e disponibiliza um token JWT válido."""
    session = TestSessionLocal()

    user = UserModel(
        name="Usuário de Teste JWT",
        email=f"jwt-test-{uuid4().hex}@example.com",
        password_hash=UserAuthService().hash_password("SenhaTeste-123"),
    )

    try:
        session.add(user)
        session.commit()
        session.refresh(user)

        token = UserAuthService().create_access_token(user.id)

        yield user, token

    finally:
        session.rollback()

        user_id = user.id
        existing_user = (
            session.query(UserModel)
            .filter(UserModel.id == user_id)
            .first()
        )

        if existing_user is not None:
            session.delete(existing_user)
            session.commit()

        session.close()


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/devices",
        "/api/v1/events",
        "/api/v1/users",
        f"/api/v1/events/{uuid4()}/devices",
    ],
)
def test_protected_endpoint_rejects_missing_token(client, endpoint):
    """Endpoints protegidos devem rejeitar requisições sem token."""
    response = client.get(endpoint)

    assert response.status_code == 401


@pytest.mark.parametrize(
    "endpoint",
    [
        "/api/v1/devices",
        "/api/v1/events",
        "/api/v1/users",
    ],
)
def test_protected_endpoint_rejects_invalid_token(client, endpoint):
    """Endpoints protegidos devem rejeitar tokens inválidos."""
    response = client.get(
        endpoint,
        headers={"Authorization": "Bearer token-invalido"},
    )

    assert response.status_code == 401


def test_protected_endpoint_accepts_valid_token(
    client,
    authenticated_user,
):
    """Um usuário autenticado deve conseguir consultar os usuários."""
    user, token = authenticated_user

    response = client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert any(item["id"] == str(user.id) for item in response.json())


def test_login_rejects_invalid_credentials(client):
    """O login deve rejeitar credenciais inexistentes ou incorretas."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "usuario-inexistente@example.com",
            "password": "SenhaIncorreta-123",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha inválidos."


def test_login_accepts_valid_credentials(
    client,
    authenticated_user,
):
    """O login deve emitir um JWT para credenciais válidas."""
    user, _ = authenticated_user

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": user.email,
            "password": "SenhaTeste-123",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user_id"] == str(user.id)
    assert body["email"] == user.email
    assert body["name"] == user.name