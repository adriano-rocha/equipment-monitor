from dataclasses import dataclass
from uuid import UUID

from app.application.exceptions import DeviceAlreadyExistsError, DeviceNotFoundError
from app.application.ports.device_repository import DeviceRepository
from app.domain.device import Device


@dataclass(frozen=True)
class UpdateDeviceInput:
    device_id: UUID
    asset_number: str | None = None
    device_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None


class UpdateDeviceUseCase:
    def __init__(self, device_repository: DeviceRepository) -> None:
        self._device_repo = device_repository

    def execute(self, input_data: UpdateDeviceInput) -> Device:
        device = self._device_repo.get_by_id(input_data.device_id)
        if device is None:
            raise DeviceNotFoundError()

        # Se alterar o patrimônio, valida se já pertence a outro
        if input_data.asset_number is not None and input_data.asset_number != device.asset_number:
            existing = self._device_repo.get_by_asset_number(input_data.asset_number)
            if existing is not None and existing.id != device.id:
                raise DeviceAlreadyExistsError(
                    f"Patrimônio '{input_data.asset_number}' já cadastrado."
                )
            device.asset_number = input_data.asset_number

        if input_data.device_type is not None:
            device.device_type = input_data.device_type
        if input_data.manufacturer is not None:
            device.manufacturer = input_data.manufacturer
        if input_data.model is not None:
            device.model = input_data.model
        if input_data.serial_number is not None:
            device.serial_number = input_data.serial_number

        self._device_repo.update(device)
        return device