from datetime import datetime, timezone
from uuid import UUID

from app.application.exceptions import DeviceNotFoundError
from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.application.ports.device_repository import DeviceRepository
from app.domain.device_credential import DeviceCredentialStatus


class DeleteDeviceUseCase:
    def __init__(
        self,
        device_repository: DeviceRepository,
        credential_repository: DeviceCredentialRepository,
    ) -> None:
        self._device_repo = device_repository
        self._credential_repo = credential_repository

    def execute(self, device_id: UUID) -> None:
        device = self._device_repo.get_by_id(device_id)
        if device is None:
            raise DeviceNotFoundError()

        # 1. Soft-delete do equipamento (preserva histórico)
        device.deleted_at = datetime.now(timezone.utc)
        self._device_repo.update(device)

        # 2. Revogação imediata da credencial ativa
        credential = self._credential_repo.get_by_device_id(device_id)
        if credential is not None:
            credential.status = DeviceCredentialStatus.REVOKED
            self._credential_repo.update(credential)