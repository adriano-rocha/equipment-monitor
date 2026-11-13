"""Schemas Pydantic para a API de eventos com suporte à Cerca Virtual Circular e Poligonal."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=255)
    starts_at: datetime
    ends_at: datetime
    is_active: bool = False
    # 👉 Coordenadas e Cercas
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius: float | None = 250.0
    geofence_polygon: list[list[float]] | None = None

    @model_validator(mode="after")
    def validate_period(self) -> "EventCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at deve ser posterior a starts_at.")
        return self


class EventUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=255)
    starts_at: datetime
    ends_at: datetime
    is_active: bool
    # 👉 Coordenadas e Cercas
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius: float | None = None
    geofence_polygon: list[list[float]] | None = None

    @model_validator(mode="after")
    def validate_period(self) -> "EventUpdate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at deve ser posterior a starts_at.")
        return self


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    location: str
    starts_at: datetime
    ends_at: datetime
    is_active: bool
    # 👉 Retorna as coordenadas e cercas para o Frontend e Mapa
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius: float | None = 250.0
    geofence_polygon: list[list[float]] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ClosureDeviceItem(BaseModel):
    id: UUID
    asset_number: str
    device_type: str | None = None
    model: str | None = None
    location_point: str | None = None
    battery_level: int | None = None
    operational_state: str
    last_seen: datetime | None = None


class EventClosureReportResponse(BaseModel):
    event_id: UUID
    event_name: str
    generated_at: datetime
    total_devices: int
    total_collected: int
    total_pending: int
    collection_rate_percent: float
    counts_by_type: dict[str, int]
    pending_devices: list[ClosureDeviceItem]
    collected_devices: list[ClosureDeviceItem]