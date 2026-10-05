"""Schemas Pydantic para a API de eventos."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=255)
    starts_at: datetime
    ends_at: datetime
    is_active: bool = False

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
    created_at: datetime | None = None
    updated_at: datetime | None = None