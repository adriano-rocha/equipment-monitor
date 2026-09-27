"""Fixtures dos testes de API — TestClient com a Session de teste injetada
via dependency_overrides (a app usa DATABASE_URL de produção por padrão;
aqui trocamos por TEST_DATABASE_URL, sem precisar de nenhum banco separado
rodando à parte)."""

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel
from app.interface.deps import get_db_session
from app.interface.main import app
from tests.database import TestSessionLocal


def _override_get_db_session():
    session = TestSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


app.dependency_overrides[get_db_session] = _override_get_db_session


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    """Sessão separada, só para seed/verificação dos testes — não é a MESMA
    sessão que a rota usa internamente (cada requisição HTTP abre a sua via
    _override_get_db_session), mas aponta para o mesmo banco de teste."""
    session = TestSessionLocal()
    yield session
    session.close()

    cleanup = TestSessionLocal()
    cleanup.query(HeartbeatModel).delete()
    cleanup.query(DeviceCredentialModel).delete()
    cleanup.query(DeviceModel).delete()
    cleanup.commit()
    cleanup.close()