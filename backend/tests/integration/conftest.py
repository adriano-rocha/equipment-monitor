"""Fixture db_session dos testes de integração — usa o banco de teste
compartilhado (ver tests/database.py e tests/conftest.py)."""

import pytest

from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel
from tests.database import TestSessionLocal


@pytest.fixture
def db_session():
    session = TestSessionLocal()
    yield session
    session.close()

    cleanup = TestSessionLocal()
    cleanup.query(HeartbeatModel).delete()
    cleanup.query(DeviceCredentialModel).delete()
    cleanup.query(DeviceModel).delete()
    cleanup.commit()
    cleanup.close()