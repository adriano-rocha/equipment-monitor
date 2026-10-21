"""Modelo SQLAlchemy da tabela devices.

Mantém os campos utilizados pelo fluxo de heartbeat e adiciona os
dados operacionais necessários para o inventário da Fase 06.

O status de comunicação NÃO é persistido aqui como fonte de verdade.
Ele continua sendo derivado pelo backend a partir de last_seen.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class DeviceModel(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    asset_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
    )

    device_type: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    manufacturer: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    model: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    serial_number: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        index=True,
    )

    hostname: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    reported_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    battery_level: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    last_seen: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )