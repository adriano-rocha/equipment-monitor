"""DeviceAuthService — autentica um dispositivo via header
Authorization: DeviceKey <key_id>:<secret> (ADR-006).

Retorna o Device E a DeviceCredential já resolvidos para o Use Case usar —
evita consultar os dois de novo (a credencial já foi carregada aqui para
verificar o secret; o Use Case precisa dela para atualizar last_used_at).
"""

from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.application.exceptions import InvalidDeviceCredentialsError
from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.application.ports.device_repository import DeviceRepository
from app.domain.device import Device
from app.domain.device_credential import DeviceCredential

_AUTH_SCHEME = "DeviceKey"


@dataclass
class AuthenticatedDevice:
    device: Device
    credential: DeviceCredential


class DeviceAuthService:
    def __init__(
        self,
        credential_repository: DeviceCredentialRepository,
        device_repository: DeviceRepository,
        password_hasher: PasswordHasher | None = None,
    ) -> None:
        self._credential_repository = credential_repository
        self._device_repository = device_repository
        self._password_hasher = password_hasher or PasswordHasher()

    def authenticate(self, authorization_header: str | None) -> AuthenticatedDevice:
        key_id, secret = self._parse_header(authorization_header)

        credential = self._credential_repository.get_by_key_id(key_id)
        if credential is None:
            raise InvalidDeviceCredentialsError()

        if not credential.is_active():
            raise InvalidDeviceCredentialsError()

        if not self._verify_secret(secret, credential.secret_hash):
            raise InvalidDeviceCredentialsError()

        device = self._device_repository.get_by_id(credential.device_id)
        if device is None:
            raise InvalidDeviceCredentialsError()

        return AuthenticatedDevice(device=device, credential=credential)

    def _verify_secret(self, secret: str, secret_hash: str) -> bool:
        try:
            self._password_hasher.verify(secret_hash, secret)
            return True
        except VerifyMismatchError:
            return False

    @staticmethod
    def _parse_header(authorization_header: str | None) -> tuple[str, str]:
        if authorization_header is None:
            raise InvalidDeviceCredentialsError()

        scheme, _, credentials = authorization_header.partition(" ")
        if scheme != _AUTH_SCHEME or not credentials:
            raise InvalidDeviceCredentialsError()

        key_id, sep, secret = credentials.partition(":")
        if not sep or not key_id or not secret:
            raise InvalidDeviceCredentialsError()

        return key_id, secret