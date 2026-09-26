"""Modelo SQLAlchemy da tabela devices.

Reflete apenas os campos que o fluxo de heartbeat (SPEC-001) lê e atualiza.
communication_status/operational_state (ADR-007) entram quando a spec
correspondente exigir.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class DeviceModel(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asset_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reported_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)