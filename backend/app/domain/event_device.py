"""Entidade de domínio: EventDevice.

Representa a associação histórica entre um equipamento e um evento,
incluindo o ponto físico (Decisão D) e o responsável contextual (Decisão C).

A associação permanece ativa enquanto ``unassigned_at`` for None.

Quando o responsável ou o ponto físico muda, a associação atual deve ser 
encerrada e uma nova criada. Dessa forma, o histórico e a rastreabilidade 
são preservados integralmente.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class EventDevice:
    id: UUID
    event_id: UUID
    device_id: UUID
    location_point: str | None = None
    assigned_user_id: UUID | None = None
    assigned_at: datetime | None = None
    unassigned_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def is_active(self) -> bool:
        """Indica se a associação ainda está ativa."""
        return self.unassigned_at is None

    def unassign(self, *, unassigned_at: datetime) -> None:
        """Encerra a associação mantendo o histórico."""
        if self.unassigned_at is not None:
            raise ValueError("A associação já foi encerrada.")

        if (
            self.assigned_at is not None
            and unassigned_at < self.assigned_at
        ):
            raise ValueError(
                "unassigned_at não pode ser anterior a assigned_at."
            )

        self.unassigned_at = unassigned_at
        self.updated_at = unassigned_at