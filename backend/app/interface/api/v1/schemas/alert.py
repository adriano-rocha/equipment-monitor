from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DeviceAlertPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = "ALERT_TRIGGERED"
    severity: str  # "CRITICAL" | "WARNING"
    reason: str  # "BATTERY_CRITICAL" | "SEM_COMUNICACAO" | "OFFLINE"
    device_id: str
    asset_tag: str
    device_name: str
    battery_level: Optional[float] = None
    is_charging: Optional[bool] = None
    event_id: Optional[str] = None
    event_name: Optional[str] = None
    location_point: Optional[str] = None
    responsible_name: Optional[str] = None
    timestamp: datetime
    