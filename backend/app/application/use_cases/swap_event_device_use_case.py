from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select

# Ajuste conforme a importação dos seus modelos ORM
from app.infrastructure.db.models.event_device import EventDeviceModel # type: ignore


@dataclass(frozen=True)
class SwapEventDeviceInput:
    event_id: UUID
    current_device_id: UUID
    new_device_id: UUID


class SwapEventDeviceUseCase:
    def __init__(self, session: Session) -> None:
        self.session = session

    def execute(self, input_data: SwapEventDeviceInput) -> EventDeviceModel:
        now = datetime.now(timezone.utc)

        # 1. Localiza o vínculo ativo do equipamento com problema no evento
        stmt_old = select(EventDeviceModel).where(
            EventDeviceModel.event_id == input_data.event_id,
            EventDeviceModel.device_id == input_data.current_device_id,
            EventDeviceModel.unassigned_at.is_(None)
        )
        old_assoc = self.session.execute(stmt_old).scalars().first()
        if not old_assoc:
            raise ValueError("Equipamento de origem não está alocado ativamente neste evento.")

        # 2. Desvincula o equipamento antigo
        old_assoc.unassigned_at = now

        # 3. Se o novo equipamento já estiver alocado ativamente em qualquer outro ponto/evento, encerra
        stmt_new_active = select(EventDeviceModel).where(
            EventDeviceModel.device_id == input_data.new_device_id,
            EventDeviceModel.unassigned_at.is_(None)
        )
        new_active = self.session.execute(stmt_new_active).scalars().first()
        if new_active:
            new_active.unassigned_at = now

        # 4. Cria a nova alocação herdando o mesmo ponto físico e o mesmo responsável
        new_assoc = EventDeviceModel(
            id=uuid.uuid4(),
            event_id=input_data.event_id,
            device_id=input_data.new_device_id,
            location_point=old_assoc.location_point,
            assigned_user_id=old_assoc.assigned_user_id,
            assigned_at=now,
        )
        self.session.add(new_assoc)
        return new_assoc