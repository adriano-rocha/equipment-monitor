from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    operational_state: str | None = Field(default=None, max_length=30)

    @field_validator("operational_state")
    @classmethod
    def validate_operational_state(cls, value: str | None) -> str | None:
        allowed_states = {
            "ATIVO",
            "RECOLHIDO",
            "EM_MANUTENCAO",
            "DESATIVADO",
        }
        if value is not None and value not in allowed_states:
            raise ValueError("Estado operacional inválido.")
        return value


class DeviceCheckinRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    asset_code: str = Field(..., min_length=1, max_length=50, description="Patrimônio completo ou 4 dígitos finais")


class DeviceUndoCheckinRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    query: str | None = Field(default=None, min_length=1, max_length=50)
    device_id: UUID | None = None

    @model_validator(mode="after")
    def validate_target(self) -> "DeviceUndoCheckinRequest":
        if self.query is None and self.device_id is None:
            raise ValueError("Informe query ou device_id.")
        return self


class DeviceCheckinResponse(BaseModel):
    id: UUID
    asset_number: str
    device_type: str | None
    model: str | None
    operational_state: str
    already_collected: bool
    message: str