"""Modelo SQLAlchemy da tabela heartbeats (ADR-003, ADR-008).

Histórico — nunca é sobrescrito, sempre um INSERT novo por comunicação
recebida. received_at é definido pelo servidor; device_timestamp é só
telemetria informativa.

🔑 palavra-chave: o atributo Python é `metadata_` (com underscore), não
`metadata` — `Base.metadata` já é um atributo reservado do SQLAlchemy
declarative (guarda o esquema de todas as tabelas). Usamos
`mapped_column("metadata", ...)` para o NOME DA COLUNA no banco continuar
"metadata", só o atributo Python muda.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class HeartbeatModel(Base):
    __tablename__ = "heartbeats"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("devices.id"), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_ip: Mapped[str] = mapped_column(String(45))
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reported_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    device_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)