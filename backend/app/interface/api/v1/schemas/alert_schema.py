from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class DeviceAlertPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = "ALERT_TRIGGERED"
    severity: str  # "CRITICAL" | "WARNING"
    reason: str    # "BATTERY_CRITICAL" | "SEM_COMUNICACAO" | "OFFLINE"
    device_id: UUID
    asset_number: str
    device_type: str | None = None
    battery_level: float | None = None
    event_id: UUID | None = None
    event_name: str | None = None
    location_point: str | None = None
    responsible_name: str | None = None
    timestamp: datetime