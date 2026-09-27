"""Testes do DeviceAuthService — repositórios fake (sem banco), mas hashing
argon2 real (é comportamento central da autenticação, ADR-006)."""

from uuid import uuid4

import pytest
from argon2 import PasswordHasher

from app.application.exceptions import InvalidDeviceCredentialsError
from app.domain.device import Device
from app.domain.device_credential import DeviceCredential, DeviceCredentialStatus
from app.infrastructure.auth.device_auth_service import DeviceAuthService
from tests.unit.fakes import FakeDeviceCredentialRepository, FakeDeviceRepository

_HASHER = PasswordHasher()


def _make_service_with_credential(secret: str, status=DeviceCredentialStatus.ACTIVE):
    device = Device(id=uuid4(), asset_number="NB-001")
    credential = DeviceCredential(
        id=uuid4(),
        device_id=device.id,
        key_id="key-abc",
        secret_hash=_HASHER.hash(secret),
        status=status,
    )

    device_repo = FakeDeviceRepository()
    device_repo.add(device)
    credential_repo = FakeDeviceCredentialRepository()
    credential_repo.add(credential)

    service = DeviceAuthService(credential_repository=credential_repo, device_repository=device_repo)
    return service, device


def test_authenticate_succeeds_with_valid_credentials():
    service, device = _make_service_with_credential(secret="s3gredo")

    result = service.authenticate("DeviceKey key-abc:s3gredo")

    assert result.device.id == device.id
    assert result.credential.key_id == "key-abc"


@pytest.mark.parametrize(
    "header",
    [
        None,
        "",
        "Bearer key-abc:s3gredo",  # esquema errado
        "DeviceKey key-abc",  # sem ":"
        "DeviceKey :s3gredo",  # key_id vazio
        "DeviceKey key-abc:",  # secret vazio
    ],
)
def test_authenticate_rejects_malformed_header(header):
    service, _ = _make_service_with_credential(secret="s3gredo")

    with pytest.raises(InvalidDeviceCredentialsError):
        service.authenticate(header)


def test_authenticate_rejects_unknown_key_id():
    service, _ = _make_service_with_credential(secret="s3gredo")

    with pytest.raises(InvalidDeviceCredentialsError):
        service.authenticate("DeviceKey key-inexistente:s3gredo")


def test_authenticate_rejects_wrong_secret():
    service, _ = _make_service_with_credential(secret="s3gredo")

    with pytest.raises(InvalidDeviceCredentialsError):
        service.authenticate("DeviceKey key-abc:secret-errado")


def test_authenticate_rejects_revoked_credential():
    service, _ = _make_service_with_credential(secret="s3gredo", status=DeviceCredentialStatus.REVOKED)

    with pytest.raises(InvalidDeviceCredentialsError):
        service.authenticate("DeviceKey key-abc:s3gredo")