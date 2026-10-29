"""Serviço de aplicação para operações de eventos."""

from datetime import datetime
from uuid import UUID, uuid4

from app.application.exceptions import EventNotFoundError
from app.application.ports.event_repository import EventRepository
from app.domain.event import Event


class EventService:
    def __init__(self, event_repository: EventRepository) -> None:
        self._event_repository = event_repository

    def create(
        self,
        *,
        name: str,
        location: str,
        starts_at: datetime,
        ends_at: datetime,
        is_active: bool = False,
    ) -> Event:
        event = Event(
            id=uuid4(),
            name=name,
            location=location,
            starts_at=starts_at,
            ends_at=ends_at,
            is_active=is_active,
        )

        self._event_repository.add(event)

        return event

    def get_by_id(self, event_id: UUID) -> Event | None:
        return self._event_repository.get_by_id(event_id)

    def list_all(self) -> list[Event]:
        return self._event_repository.list_all()

    def list_by_period(
        self,
        *,
        starts_at: datetime | None = None,
        ends_at: datetime | None = None,
        is_active: bool | None = None,
    ) -> list[Event]:
        return self._event_repository.list_by_period(
            starts_at=starts_at,
            ends_at=ends_at,
            is_active=is_active,
        )

    def update(
        self,
        *,
        event_id: UUID,
        name: str,
        location: str,
        starts_at: datetime,
        ends_at: datetime,
        is_active: bool,
    ) -> Event:
        event = self._event_repository.get_by_id(event_id)

        if event is None:
            raise EventNotFoundError()

        updated_event = Event(
            id=event.id,
            name=name,
            location=location,
            starts_at=starts_at,
            ends_at=ends_at,
            is_active=is_active,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )

        self._event_repository.update(updated_event)

    def delete(self, event_id: UUID) -> None:
        self._event_repository.delete(event_id)
