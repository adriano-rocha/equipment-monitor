"""Testes de integração do RegisterHeartbeatUseCase — repositórios SQLAlchemy
reais + PostgreSQL real. Complementa o T07 (que testou os repositórios
isolados): aqui é o Use Case inteiro, do jeito que a rota (T10) realmente usa.
"""

from datetime import datetime, timezone

from app.application.use_cases.register_heartbeat import RegisterHeartbeatCommand, RegisterHeartbeatUseCase
from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import SqlAlchemyDeviceRepository
from app.infrastructure.db.repositories.sqlalchemy_heartbeat_repository import SqlAlchemyHeartbeatRepository
from tests.seed_helpers import seed_device_and_credential


def _build_use_case(db_session) -> RegisterHeartbeatUseCase:
    return RegisterHeartbeatUseCase(
        device_repository=SqlAlchemyDeviceRepository(db_session),
        credential_repository=SqlAlchemyDeviceCredentialRepository(db_session),
        heartbeat_repository=SqlAlchemyHeartbeatRepository(db_session),
    )


def test_use_case_persists_heartbeat_end_to_end(db_session):
    device_id, credential_id = seed_device_and_credential(db_session, key_id="key-e2e-feliz")
    use_case = _build_use_case(db_session)

    device_repo = SqlAlchemyDeviceRepository(db_session)
    credential_repo = SqlAlchemyDeviceCredentialRepository(db_session)
    device = device_repo.get_by_id(device_id)
    credential = credential_repo.get_by_key_id("key-e2e-feliz")

    received_at = datetime.now(timezone.utc)
    command = RegisterHeartbeatCommand(
        device=device,
        credential=credential,
        received_at=received_at,
        source_ip="10.0.0.20",
        hostname="notebook-e2e",
        battery_level=65,
    )

    heartbeat = use_case.execute(command)
    db_session.commit()

    persisted_device = db_session.get(DeviceModel, device_id)
    persisted_credential = db_session.get(DeviceCredentialModel, credential_id)

    assert persisted_device.hostname == "notebook-e2e"
    assert persisted_device.battery_level == 65
    assert persisted_device.last_seen == received_at
    assert persisted_credential.last_used_at == received_at
    assert heartbeat.id is not None


def test_use_case_does_not_overwrite_omitted_fields_across_two_real_heartbeats(db_session):
    """Prova, com round-trip real no banco (não só em memória, como no T04),
    que um campo omitido em um heartbeat NÃO apaga o valor salvo por um
    heartbeat anterior."""
    device_id, credential_id = seed_device_and_credential(db_session, key_id="key-e2e-parcial")

    device_repo = SqlAlchemyDeviceRepository(db_session)
    credential_repo = SqlAlchemyDeviceCredentialRepository(db_session)

    # 1º heartbeat: informa hostname.
    use_case = _build_use_case(db_session)
    device = device_repo.get_by_id(device_id)
    credential = credential_repo.get_by_key_id("key-e2e-parcial")
    use_case.execute(
        RegisterHeartbeatCommand(
            device=device,
            credential=credential,
            received_at=datetime.now(timezone.utc),
            source_ip="10.0.0.21",
            hostname="notebook-persistente",
        )
    )
    db_session.commit()

    # 2º heartbeat: NÃO informa hostname — deve continuar com o valor salvo.
    use_case2 = _build_use_case(db_session)
    device_again = device_repo.get_by_id(device_id)
    credential_again = credential_repo.get_by_key_id("key-e2e-parcial")
    use_case2.execute(
        RegisterHeartbeatCommand(
            device=device_again,
            credential=credential_again,
            received_at=datetime.now(timezone.utc),
            source_ip="10.0.0.21",
        )
    )
    db_session.commit()

    persisted_device = db_session.get(DeviceModel, device_id)
    assert persisted_device.hostname == "notebook-persistente"