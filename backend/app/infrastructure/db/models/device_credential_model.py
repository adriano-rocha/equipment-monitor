"""Modelo SQLAlchemy da tabela device_credentials (ADR-006).

key_id é público e indexado (lookup rápido no DeviceAuthService). secret NUNCA
é armazenado — só secret_hash. status controla ACTIVE/REVOKED.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.device_credential import DeviceCredentialStatus
from app.infrastructure.db.base import Base


class DeviceCredentialModel(Base):
    __tablename__ = "device_credentials"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("devices.id"), index=True)
    key_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    secret_hash: Mapped[str] = mapped_column(String(255))
    status: Mapped[DeviceCredentialStatus] = mapped_column(
        SqlEnum(DeviceCredentialStatus, name="device_credential_status"),
        default=DeviceCredentialStatus.ACTIVE,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)