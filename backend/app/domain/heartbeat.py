"""Entidade de domínio: Heartbeat (ADR-003, ADR-008).

Heartbeat é histórico — cada instância representa UMA comunicação recebida
pelo backend; nunca é sobrescrito. received_at (definido pelo servidor) é a
fonte oficial de tempo — device_timestamp é só telemetria informativa,
nunca usado para decisões do backend.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Heartbeat:
    id: UUID
    device_id: UUID
    received_at: datetime
    source_ip: str
    hostname: str | None = None
    reported_ip: str | None = None
    battery_level: int | None = None
    metadata: dict | None = None
    device_timestamp: datetime | None = None