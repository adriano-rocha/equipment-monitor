"""Caso de uso: CreateDeviceUseCase.

Cadastra um novo equipamento e gera atômica e simultaneamente sua
credencial DeviceKey (ADR-006). O secret é retornado em claro apenas no
output deste use case. O banco guarda exclusivamente o hash Argon2.
"""

from dataclasses import dataclass
import secrets
import uuid

from argon2 import PasswordHasher

from app.application.exceptions import DeviceAlreadyExistsError
from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.application.ports.device_repository import DeviceRepository
from app.domain.device import Device
from app.domain.device_credential import DeviceCredential, DeviceCredentialStatus


@dataclass(frozen=True)
class CreateDeviceInput:
    asset_number: str
    device_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None


@dataclass(frozen=True)
class CreateDeviceOutput:
    device: Device
    key_id: str
    secret: str


class CreateDeviceUseCase:
    def __init__(
        self,
        device_repository: DeviceRepository,
        credential_repository: DeviceCredentialRepository,
        password_hasher: PasswordHasher | None = None,
    ) -> None:
        self._device_repo = device_repository
        self._credential_repo = credential_repository
        self._hasher = password_hasher or PasswordHasher()

    def execute(self, input_data: CreateDeviceInput) -> CreateDeviceOutput:
        # 1. Validação prévia de duplicidade de patrimônio
        existing = self._device_repo.get_by_asset_number(input_data.asset_number)
        if existing is not None:
            raise DeviceAlreadyExistsError(
                f"Equipamento com patrimônio '{input_data.asset_number}' já cadastrado."
            )

        # 2. Criação da entidade de domínio Device
        device_id = uuid.uuid4()
        device = Device(
            id=device_id,
            asset_number=input_data.asset_number,
            device_type=input_data.device_type,
            manufacturer=input_data.manufacturer,
            model=input_data.model,
            serial_number=input_data.serial_number,
        )

        # 3. Geração aleatória e segura da credencial (secrets)
        key_id = secrets.token_hex(4)
        secret = secrets.token_hex(4)
        secret_hash = self._hasher.hash(secret)

        credential = DeviceCredential(
            id=uuid.uuid4(),
            device_id=device_id,
            key_id=key_id,
            secret_hash=secret_hash,
            status=DeviceCredentialStatus.ACTIVE,
        )

        # 4. Persistência atômica via flush
        self._device_repo.add(device)
        self._credential_repo.add(credential)

        return CreateDeviceOutput(
            device=device,
            key_id=key_id,
            secret=secret,
        )