"""Entidade de domínio: Event.

Representa um evento operacional ao qual equipamentos podem ser
associados durante determinado período.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Event:
    id: UUID
    name: str
    location: str
    starts_at: datetime
    ends_at: datetime
    is_active: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at deve ser posterior a starts_at.")