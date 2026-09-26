"""Testes de domínio: Device.register_heartbeat e DeviceCredential.is_active."""

from datetime import datetime, timezone
from uuid import uuid4

from app.domain.device import Device
from app.domain.device_credential import DeviceCredential, DeviceCredentialStatus


def test_register_heartbeat_updates_last_seen_always():
    device = Device(id=uuid4(), asset_number="NB-001")
    received_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    device.register_heartbeat(
        received_at=received_at, hostname=None, reported_ip=None, battery_level=None
    )

    assert device.last_seen == received_at


def test_register_heartbeat_does_not_overwrite_when_field_omitted():
    device = Device(id=uuid4(), asset_number="NB-001", hostname="notebook-antigo")

    device.register_heartbeat(
        received_at=datetime.now(timezone.utc),
        hostname=None,
        reported_ip=None,
        battery_level=None,
    )

    assert device.hostname == "notebook-antigo"


def test_register_heartbeat_overwrites_when_field_sent():
    device = Device(id=uuid4(), asset_number="NB-001", hostname="notebook-antigo")

    device.register_heartbeat(
        received_at=datetime.now(timezone.utc),
        hostname="notebook-novo",
        reported_ip="192.168.0.10",
        battery_level=80,
    )

    assert device.hostname == "notebook-novo"
    assert device.reported_ip == "192.168.0.10"
    assert device.battery_level == 80


def test_device_credential_is_active_true_only_when_active():
    credential = DeviceCredential(
        id=uuid4(),
        device_id=uuid4(),
        key_id="abc123",
        secret_hash="hash-fake",
        status=DeviceCredentialStatus.ACTIVE,
    )
    revoked = DeviceCredential(
        id=uuid4(),
        device_id=uuid4(),
        key_id="def456",
        secret_hash="hash-fake",
        status=DeviceCredentialStatus.REVOKED,
    )

    assert credential.is_active() is True
    assert revoked.is_active() is False