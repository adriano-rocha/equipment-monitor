"""Detecção de transições de status dos devices."""

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID


@dataclass(frozen=True)
class DeviceStatusChangedEvent:
    device_id: UUID
    asset_number: str
    previous_status: str
    status: str
    timestamp: datetime

    def to_dict(self) -> dict:
        return {
            "event": "device_status_changed",
            "device_id": str(self.device_id),
            "asset_number": self.asset_number,
            "previous_status": self.previous_status,
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
        }


class StatusEventService:
    """Mantém o último estado conhecido de cada device em memória."""

    def __init__(self) -> None:
        self._statuses: dict[UUID, str] = {}

    def initialize(self, device_id: UUID, status: str) -> None:
        """Registra o estado inicial sem disparar evento."""
        self._statuses[device_id] = status

    def process(
        self,
        *,
        device_id: UUID,
        asset_number: str,
        status: str,
    ) -> DeviceStatusChangedEvent | None:
        previous_status = self._statuses.get(device_id)

        self._statuses[device_id] = status

        if previous_status is None or previous_status == status:
            return None

        return DeviceStatusChangedEvent(
            device_id=device_id,
            asset_number=asset_number,
            previous_status=previous_status,
            status=status,
            timestamp=datetime.now(timezone.utc),
        )

    def remove_missing_devices(self, active_device_ids: set[UUID]) -> None:
        for device_id in list(self._statuses):
            if device_id not in active_device_ids:
                del self._statuses[device_id]