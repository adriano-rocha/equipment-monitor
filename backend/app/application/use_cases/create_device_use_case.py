"""Caso de uso: CreateDeviceUseCase.

Cadastra um novo equipamento ou reativa inteligentemente um patrimônio excluído,
gerando atômica e simultaneamente sua credencial DeviceKey (ADR-006). O secret é
retornado em claro apenas no output deste use case. O banco guarda exclusivamente o hash Argon2.
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
        # 1. Busca por patrimônio existente (inclusive os soft-deleted)
        existing = self._device_repo.get_by_asset_number(
            input_data.asset_number, include_deleted=True
        )

        # Se já existe e está ATIVO no inventário -> Conflito 409 legítimo
        if existing is not None and existing.deleted_at is None:
            raise DeviceAlreadyExistsError(
                f"Equipamento com patrimônio '{input_data.asset_number}' já cadastrado."
            )

        # Se já existia mas estava EXCLUÍDO -> Reativação Inteligente (Undelete)
        if existing is not None and existing.deleted_at is not None:
            existing.deleted_at = None
            existing.device_type = input_data.device_type
            existing.manufacturer = input_data.manufacturer
            existing.model = input_data.model
            existing.serial_number = input_data.serial_number
            self._device_repo.update(existing)

            # Gera nova credencial ativa para o aparelho reativado
            key_id = f"key_{secrets.token_hex(4)}"
            secret = f"sec_{secrets.token_hex(8)}"
            secret_hash = self._hasher.hash(secret)

            credential = DeviceCredential(
                id=uuid.uuid4(),
                device_id=existing.id,
                key_id=key_id,
                secret_hash=secret_hash,
                status=DeviceCredentialStatus.ACTIVE,
            )
            self._credential_repo.add(credential)

            return CreateDeviceOutput(
                device=existing,
                key_id=key_id,
                secret=secret,
            )

        # 2. Se o patrimônio é inédito -> Criação convencional do zero
        device_id = uuid.uuid4()
        device = Device(
            id=device_id,
            asset_number=input_data.asset_number,
            device_type=input_data.device_type,
            manufacturer=input_data.manufacturer,
            model=input_data.model,
            serial_number=input_data.serial_number,
        )

        key_id = f"key_{secrets.token_hex(4)}"
        secret = f"sec_{secrets.token_hex(8)}"
        secret_hash = self._hasher.hash(secret)

        credential = DeviceCredential(
            id=uuid.uuid4(),
            device_id=device_id,
            key_id=key_id,
            secret_hash=secret_hash,
            status=DeviceCredentialStatus.ACTIVE,
        )

        self._device_repo.add(device)
        self._credential_repo.add(credential)

        return CreateDeviceOutput(
            device=device,
            key_id=key_id,
            secret=secret,
        )