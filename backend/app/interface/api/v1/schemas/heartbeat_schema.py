"""Schemas Pydantic do endpoint POST /api/v1/heartbeats.

Todo o corpo é opcional (SPEC-001) — um heartbeat vazio {} é válido.
"""

from datetime import datetime
import json
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


_METADATA_MAX_BYTES = 2048


class HeartbeatRequest(BaseModel):
    hostname: str | None = None
    reported_ip: str | None = None
    battery_level: int | None = Field(default=None, ge=0, le=100)
    metadata: dict | None = None
    device_timestamp: datetime | None = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    speed_kmh: Optional[float] = None
    accuracy: Optional[float] = None  # 👈 Margem de erro em metros do Android GPS/Network

    @field_validator("metadata")
    @classmethod
    def validate_metadata_size(cls, value: dict | None) -> dict | None:
        if value is None:
            return value
        size = len(json.dumps(value).encode("utf-8"))
        if size > _METADATA_MAX_BYTES:
            raise ValueError(f"metadata excede o limite de {_METADATA_MAX_BYTES} bytes (recebido: {size}).")
        return value


class HeartbeatResponse(BaseModel):
    id: UUID
    device_id: UUID
    received_at: datetime