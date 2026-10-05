"""Schemas Pydantic para a API de dispositivos."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DeviceResponse(BaseModel):
    id: UUID
    asset_number: str
    device_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    hostname: str | None = None
    reported_ip: str | None = None
    battery_level: int | None = None
    last_seen: datetime | None = None
    status: str