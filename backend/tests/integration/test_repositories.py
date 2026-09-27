"""Testes de integração dos repositórios SQLAlchemy — PostgreSQL real.

Comprovam:
- Persistência real dos 3 writes do fluxo de heartbeat (Device,
  DeviceCredential, Heartbeat) na mesma sessão/transação.
- Atomicidade: se um dos writes falhar, NENHUM dos três é persistido (AC-06).
"""

import uuid
from datetime import datetime, timezone

import pytest

from app.domain.heartbeat import Heartbeat
from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import SqlAlchemyDeviceRepository
from app.infrastructure.db.repositories.sqlalchemy_heartbeat_repository import SqlAlchemyHeartbeatRepository
from tests.seed_helpers import seed_device_and_credential


def test_heartbeat_flow_persists_all_three_writes_atomically(db_session):
    device_id, credential_id = seed_device_and_credential(db_session, key_id="key-fluxo-feliz")

    device_repo = SqlAlchemyDeviceRepository(db_session)
    credential_repo = SqlAlchemyDeviceCredentialRepository(db_session)
    heartbeat_repo = SqlAlchemyHeartbeatRepository(db_session)

    device = device_repo.get_by_id(device_id)
    device.register_heartbeat(
        received_at=datetime.now(timezone.utc),
        hostname="notebook-01",
        reported_ip="10.0.0.5",
        battery_level=77,
    )

    credential = credential_repo.get_by_key_id("key-fluxo-feliz")
    credential.last_used_at = device.last_seen

    heartbeat = Heartbeat(
        id=uuid.uuid4(), device_id=device_id, received_at=device.last_seen, source_ip="10.0.0.5"
    )

    device_repo.update(device)
    credential_repo.update(credential)
    heartbeat_repo.add(heartbeat)
    db_session.commit()

    persisted_device = db_session.get(DeviceModel, device_id)
    persisted_credential = db_session.get(DeviceCredentialModel, credential_id)
    persisted_heartbeat = db_session.get(HeartbeatModel, heartbeat.id)

    assert persisted_device.hostname == "notebook-01"
    assert persisted_device.battery_level == 77
    assert persisted_credential.last_used_at == device.last_seen
    assert persisted_heartbeat is not None
    assert persisted_heartbeat.source_ip == "10.0.0.5"


def test_heartbeat_flow_rolls_back_completely_on_failure(db_session):
    device_id, _ = seed_device_and_credential(db_session, key_id="key-rollback")

    device_repo = SqlAlchemyDeviceRepository(db_session)

    device = device_repo.get_by_id(device_id)
    device.register_heartbeat(
        received_at=datetime.now(timezone.utc),
        hostname="HOSTNAME-NAO-DEVERIA-PERSISTIR",
        reported_ip=None,
        battery_level=None,
    )
    device_repo.update(device)

    db_session.add(
        HeartbeatModel(
            id=uuid.uuid4(),
            device_id=uuid.uuid4(),
            received_at=datetime.now(timezone.utc),
            source_ip="10.0.0.5",
        )
    )

    with pytest.raises(Exception):
        db_session.commit()
    db_session.rollback()

    reloaded = db_session.get(DeviceModel, device_id)
    assert reloaded.hostname is None