"""Schemas Pydantic para associações entre eventos e equipamentos."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EventDeviceCreate(BaseModel):
    device_id: UUID
    assigned_user_id: UUID | None = None


class EventDeviceResponsibleUpdate(BaseModel):
    assigned_user_id: UUID


class EventDeviceResponse(BaseModel):
    id: UUID
    event_id: UUID
    device_id: UUID
    assigned_user_id: UUID | None = None
    assigned_at: datetime | None = None
    unassigned_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    is_active: bool