from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class DeviceCredentialsResponse(BaseModel):
    key_id: str
    secret: str


class DeviceCreateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    asset_number: str = Field(..., min_length=1, max_length=50)
    device_type: str | None = Field(default=None, max_length=50)
    manufacturer: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=150)
    serial_number: str | None = Field(default=None, max_length=150)


class DeviceCreateResponse(BaseModel):
    id: UUID
    asset_number: str
    device_type: str | None
    manufacturer: str | None
    model: str | None
    serial_number: str | None
    hostname: str | None
    reported_ip: str | None
    battery_level: int | None
    operational_state: str = "ATIVO"
    last_seen: datetime | None
    status: str
    credentials: DeviceCredentialsResponse


class DeviceResponse(BaseModel):
    id: UUID
    asset_number: str
    device_type: str | None
    manufacturer: str | None
    model: str | None
    serial_number: str | None
    hostname: str | None
    reported_ip: str | None
    battery_level: int | None
    operational_state: str = "ATIVO"
    last_seen: datetime | None
    status: str


class DeviceUpdateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    asset_number: str | None = Field(default=None, min_length=1, max_length=50)
    device_type: str | None = Field(default=None, max_length=50)
    manufacturer: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=150)
    serial_number: str | None = Field(default=None, max_length=150)
    operational_state: Literal["ATIVO", "RECOLHIDO", "EM_MANUTENCAO", "DESATIVADO"] | None = None


class DeviceCheckinRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    asset_code: str = Field(..., min_length=1, max_length=50, description="Patrimônio completo ou 4 dígitos finais")


class DeviceCheckinResponse(BaseModel):
    id: UUID
    asset_number: str
    device_type: str | None
    model: str | None
    operational_state: str
    already_collected: bool
    message: str