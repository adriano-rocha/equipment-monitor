"""DeviceAuthService — autentica um dispositivo via header
Authorization: DeviceKey <key_id>:<secret> (ADR-006).

Retorna o Device E a DeviceCredential já resolvidos para o Use Case usar —
evita consultar os dois de novo (a credencial já foi carregada aqui para
verificar o secret; o Use Case precisa dela para atualizar last_used_at).

Proteção de memória (instância de 512 MB):
- Cache TTL: o argon2 (~64 MiB por hash) só roda quando o par
  (key_id, hash, secret) não foi validado nos últimos 5 minutos.
- Semáforo: no cold start (cache vazio), no máximo 1 hash roda por vez,
  evitando o pico de memória que causava OOM em loop.
"""

import hashlib
import threading
from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cachetools import TTLCache

from app.application.exceptions import InvalidDeviceCredentialsError
from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.application.ports.device_repository import DeviceRepository
from app.domain.device import Device
from app.domain.device_credential import DeviceCredential

_AUTH_SCHEME = "DeviceKey"
_AUTH_CACHE_TTL_SECONDS = 300
_ARGON2_MAX_CONCURRENT_VERIFICATIONS = 1

_DEVICE_KEY_VALIDATION_CACHE: TTLCache = TTLCache(
    maxsize=1024,
    ttl=_AUTH_CACHE_TTL_SECONDS,
)
# TTLCache não é thread-safe; o FastAPI executa dependências síncronas em threadpool.
_CACHE_LOCK = threading.Lock()
_ARGON2_SEMAPHORE = threading.BoundedSemaphore(_ARGON2_MAX_CONCURRENT_VERIFICATIONS)


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

        # Checado ANTES do cache: credencial revogada é bloqueada na hora.
        if not credential.is_active():
            raise InvalidDeviceCredentialsError()

        if not self._verify_secret(key_id, secret, credential.secret_hash):
            raise InvalidDeviceCredentialsError()

        device = self._device_repository.get_by_id(credential.device_id)
        if device is None:
            raise InvalidDeviceCredentialsError()

        return AuthenticatedDevice(device=device, credential=credential)

    def _verify_secret(self, key_id: str, secret: str, secret_hash: str) -> bool:
        # secret_hash na chave: rotacionar o secret invalida o cache sozinho.
        cache_key = (
            key_id,
            secret_hash,
            hashlib.sha256(secret.encode("utf-8")).hexdigest(),
        )

        with _CACHE_LOCK:
            if cache_key in _DEVICE_KEY_VALIDATION_CACHE:
                return True

        with _ARGON2_SEMAPHORE:
            # Re-checa: outra thread pode ter validado este device enquanto esperávamos.
            with _CACHE_LOCK:
                if cache_key in _DEVICE_KEY_VALIDATION_CACHE:
                    return True

            try:
                self._password_hasher.verify(secret_hash, secret)
            except VerifyMismatchError:
                return False

        with _CACHE_LOCK:
            _DEVICE_KEY_VALIDATION_CACHE[cache_key] = True
        return True

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