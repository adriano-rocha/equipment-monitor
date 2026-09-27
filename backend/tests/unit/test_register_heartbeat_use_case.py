"""Testes do RegisterHeartbeatUseCase — repositórios fake (sem banco)."""

from datetime import datetime, timezone
from uuid import uuid4

from app.application.use_cases.register_heartbeat import RegisterHeartbeatCommand, RegisterHeartbeatUseCase
from app.domain.device import Device
from app.domain.device_credential import DeviceCredential, DeviceCredentialStatus
from tests.unit.fakes import FakeDeviceCredentialRepository, FakeDeviceRepository, FakeHeartbeatRepository


def _make_use_case_with_device(asset_number="NB-001", key_id="key-abc"):
    device = Device(id=uuid4(), asset_number=asset_number)
    credential = DeviceCredential(
        id=uuid4(), device_id=device.id, key_id=key_id, secret_hash="hash", status=DeviceCredentialStatus.ACTIVE
    )
    device_repo = FakeDeviceRepository()
    device_repo.add(device)
    credential_repo = FakeDeviceCredentialRepository()
    credential_repo.add(credential)
    heartbeat_repo = FakeHeartbeatRepository()

    use_case = RegisterHeartbeatUseCase(device_repo, credential_repo, heartbeat_repo)
    return use_case, device, credential, heartbeat_repo


def test_execute_updates_device_and_credential_and_registers_heartbeat():
    use_case, device, credential, heartbeat_repo = _make_use_case_with_device()
    received_at = datetime.now(timezone.utc)

    command = RegisterHeartbeatCommand(
        device=device,
        credential=credential,
        received_at=received_at,
        source_ip="10.0.0.5",
        hostname="notebook-01",
        reported_ip="192.168.0.10",
        battery_level=80,
        metadata={"os": "windows"},
    )

    heartbeat = use_case.execute(command)

    assert device.last_seen == received_at
    assert device.hostname == "notebook-01"
    assert device.battery_level == 80
    assert credential.last_used_at == received_at
    assert heartbeat.device_id == device.id
    assert heartbeat.source_ip == "10.0.0.5"
    assert heartbeat.metadata == {"os": "windows"}
    assert heartbeat_repo.added == [heartbeat]


def test_execute_accepts_empty_payload():
    use_case, device, credential, heartbeat_repo = _make_use_case_with_device(
        asset_number="NB-002", key_id="key-def"
    )
    received_at = datetime.now(timezone.utc)

    command = RegisterHeartbeatCommand(
        device=device, credential=credential, received_at=received_at, source_ip="10.0.0.9"
    )

    heartbeat = use_case.execute(command)

    assert device.last_seen == received_at
    assert device.hostname is None
    assert heartbeat.hostname is None
    assert len(heartbeat_repo.added) == 1


def test_execute_uses_server_received_at_not_device_timestamp():
    """AC-02: last_seen deve ser sempre received_at (servidor), nunca
    device_timestamp (telemetria do agente, não confiável)."""
    use_case, device, credential, _ = _make_use_case_with_device(asset_number="NB-003", key_id="key-ghi")
    received_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    device_timestamp = datetime(2020, 1, 1, tzinfo=timezone.utc)  # relógio do agente desconfigurado

    command = RegisterHeartbeatCommand(
        device=device,
        credential=credential,
        received_at=received_at,
        source_ip="10.0.0.9",
        device_timestamp=device_timestamp,
    )

    heartbeat = use_case.execute(command)

    assert device.last_seen == received_at
    assert heartbeat.received_at == received_at
    assert heartbeat.device_timestamp == device_timestamp