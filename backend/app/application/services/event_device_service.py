"""Serviço de aplicação para associações entre eventos e equipamentos."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.application.exceptions import (
    DeviceNotFoundError,
    EventDeviceAlreadyActiveError,
    EventDeviceNotFoundError,
    EventNotFoundError,
    UserNotFoundError,
)
from app.application.ports.device_repository import DeviceRepository
from app.application.ports.event_device_repository import EventDeviceRepository
from app.application.ports.event_repository import EventRepository
from app.application.ports.user_repository import UserRepository
from app.domain.event_device import EventDevice


class EventDeviceService:
    def __init__(
        self,
        *,
        event_repository: EventRepository,
        device_repository: DeviceRepository,
        event_device_repository: EventDeviceRepository,
        user_repository: UserRepository,
    ) -> None:
        self._event_repository = event_repository
        self._device_repository = device_repository
        self._event_device_repository = event_device_repository
        self._user_repository = user_repository

    def add_device(
        self,
        *,
        event_id: UUID,
        device_id: UUID,
        location_point: str | None = None,
        assigned_user_id: UUID | None = None,
    ) -> EventDevice:
        self._ensure_event_exists(event_id)
        self._ensure_device_exists(device_id)

        if assigned_user_id is not None:
            self._ensure_user_exists(assigned_user_id)

        # Se já estiver ativo no mesmo evento
        active_in_same_event = self._event_device_repository.get_active(
            event_id=event_id,
            device_id=device_id,
        )
        if active_in_same_event is not None:
            raise EventDeviceAlreadyActiveError(
                f"Device {device_id} já está associado ao Event {event_id}."
            )

        now = datetime.now(timezone.utc)

        # Se estiver ativo em outro evento, encerra a associação anterior (movimentação de evento)
        active_in_any_event = self._event_device_repository.get_active_by_device(
            device_id=device_id
        )
        if active_in_any_event is not None:
            active_in_any_event.unassign(unassigned_at=now)
            self._event_device_repository.update(active_in_any_event)

        event_device = EventDevice(
            id=uuid4(),
            event_id=event_id,
            device_id=device_id,
            location_point=location_point.strip() if location_point else None,
            assigned_user_id=assigned_user_id,
            assigned_at=now,
            created_at=now,
            updated_at=now,
        )

        self._event_device_repository.add(event_device)
        return event_device

    def list_by_event(self, event_id: UUID, active_only: bool = False) -> list[EventDevice]:
        self._ensure_event_exists(event_id)
        if active_only:
            return self._event_device_repository.list_active_by_event(event_id)
        return self._event_device_repository.list_by_event(event_id)

    def list_by_device(self, device_id: UUID) -> list[EventDevice]:
        self._ensure_device_exists(device_id)
        return self._event_device_repository.list_by_device(device_id)

    def update_assignment(
        self,
        *,
        event_id: UUID,
        device_id: UUID,
        location_point: str | None = None,
        assigned_user_id: UUID | None = None,
        clear_user: bool = False,
    ) -> EventDevice:
        """Altera o ponto físico e/ou o responsável mantendo o histórico de auditoria."""
        self._ensure_event_exists(event_id)
        self._ensure_device_exists(device_id)

        if assigned_user_id is not None:
            self._ensure_user_exists(assigned_user_id)

        current = self._event_device_repository.get_active(
            event_id=event_id,
            device_id=device_id,
        )

        if current is None:
            raise EventDeviceNotFoundError(
                f"Device {device_id} não está associado ao Event {event_id}."
            )

        now = datetime.now(timezone.utc)
        current.unassign(unassigned_at=now)
        self._event_device_repository.update(current)

        # Novo responsável: usa o novo se passado; se clear_user=True, remove; senão mantém o anterior
        new_user = None if clear_user else (
            assigned_user_id if assigned_user_id is not None else current.assigned_user_id
        )

        # Novo ponto físico: se especificado usa o novo, senão preserva o anterior
        new_point = (
            location_point.strip() if location_point is not None else current.location_point
        )

        new_assignment = EventDevice(
            id=uuid4(),
            event_id=event_id,
            device_id=device_id,
            location_point=new_point,
            assigned_user_id=new_user,
            assigned_at=now,
            created_at=now,
            updated_at=now,
        )

        self._event_device_repository.add(new_assignment)
        return new_assignment

    def assign_responsible(
        self,
        *,
        event_id: UUID,
        device_id: UUID,
        user_id: UUID,
    ) -> EventDevice:
        """Compatibilidade: atalho para update_assignment apenas com responsável."""
        return self.update_assignment(
            event_id=event_id,
            device_id=device_id,
            assigned_user_id=user_id,
        )

    def remove_device(
        self,
        *,
        event_id: UUID,
        device_id: UUID,
    ) -> EventDevice:
        self._ensure_event_exists(event_id)
        self._ensure_device_exists(device_id)

        current = self._event_device_repository.get_active(
            event_id=event_id,
            device_id=device_id,
        )

        if current is None:
            raise EventDeviceNotFoundError(
                f"Device {device_id} não está associado ao Event {event_id}."
            )

        current.unassign(unassigned_at=datetime.now(timezone.utc))
        self._event_device_repository.update(current)
        return current

    def _ensure_event_exists(self, event_id: UUID) -> None:
        if self._event_repository.get_by_id(event_id) is None:
            raise EventNotFoundError(f"Event {event_id} não encontrado.")

    def _ensure_device_exists(self, device_id: UUID) -> None:
        if self._device_repository.get_by_id(device_id) is None:
            raise DeviceNotFoundError(f"Device {device_id} não encontrado.")

    def _ensure_user_exists(self, user_id: UUID) -> None:
        if self._user_repository.get_by_id(user_id) is None:
            raise UserNotFoundError(f"User {user_id} não encontrado.")