"""Modelo SQLAlchemy da associação histórica entre eventos e equipamentos.

Cada registro representa uma associação de um equipamento a um evento.

A associação ativa possui ``unassigned_at = NULL``.
Quando o responsável muda, a associação atual é encerrada e uma nova
associação é criada, preservando o histórico.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class EventDeviceModel(Base):
    __tablename__ = "event_devices"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
    )

    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        Index("ix_event_devices_event_id", "event_id"),
        Index("ix_event_devices_device_id", "device_id"),
        Index("ix_event_devices_assigned_user_id", "assigned_user_id"),
        Index("ix_event_devices_assigned_at", "assigned_at"),
        Index(
            "uq_event_devices_active_event_device",
            "event_id",
            "device_id",
            unique=True,
            postgresql_where=text("unassigned_at IS NULL"),
        ),
    )