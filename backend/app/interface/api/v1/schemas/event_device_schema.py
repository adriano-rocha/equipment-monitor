"""Schemas Pydantic para associações entre eventos e equipamentos."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EventDeviceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    device_id: UUID
    location_point: str | None = Field(default=None, max_length=100)
    assigned_user_id: UUID | None = None


class EventDeviceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    location_point: str | None = Field(default=None, max_length=100)
    assigned_user_id: UUID | None = None
    clear_user: bool = False


class EventDeviceResponsibleUpdate(BaseModel):
    """Mantido para retrocompatibilidade."""
    model_config = ConfigDict(extra="forbid")
    assigned_user_id: UUID


class EventDeviceResponse(BaseModel):
    id: UUID
    event_id: UUID
    device_id: UUID
    location_point: str | None = None
    assigned_user_id: UUID | None = None
    assigned_at: datetime | None = None
    unassigned_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_active: bool