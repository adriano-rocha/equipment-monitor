"""Implementação SQLAlchemy do port EventRepository."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.application.exceptions import EventNotFoundError
from app.application.ports.event_repository import EventRepository
from app.domain.event import Event
from app.infrastructure.db.models.event_model import EventModel


class SqlAlchemyEventRepository(EventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, event: Event) -> None:
        model = EventModel(
        id=event.id,
        name=event.name,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        is_active=event.is_active,
    )

        self._session.add(model)
        self._session.flush()

        event.created_at = model.created_at
        event.updated_at = model.updated_at

        # O banco gera created_at/updated_at através de server_default.
        # O refresh ocorre após o flush/commit da sessão.

    def get_by_id(self, event_id: UUID) -> Event | None:
        model = self._session.get(EventModel, event_id)

        if model is None:
            return None

        return self._to_domain(model)

    def list_all(self) -> list[Event]:
        models = self._session.query(EventModel).all()
        return [self._to_domain(model) for model in models]

    def update(self, event: Event) -> None:
        model = self._session.get(EventModel, event.id)

        if model is None:
            raise EventNotFoundError()

        model.name = event.name
        model.location = event.location
        model.starts_at = event.starts_at
        model.ends_at = event.ends_at
        model.is_active = event.is_active

    def list_by_period(
        self,
        *,
        starts_at: datetime | None = None,
        ends_at: datetime | None = None,
        is_active: bool | None = None,
    ) -> list[Event]:
        query = self._session.query(EventModel)

        if starts_at is not None:
            query = query.filter(EventModel.starts_at >= starts_at)

        if ends_at is not None:
            query = query.filter(EventModel.ends_at <= ends_at)

        if is_active is not None:
            query = query.filter(EventModel.is_active == is_active)

        models = query.all()

        return [self._to_domain(model) for model in models]

    @staticmethod
    def _to_domain(model: EventModel) -> Event:
        return Event(
            id=model.id,
            name=model.name,
            location=model.location,
            starts_at=model.starts_at,
            ends_at=model.ends_at,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )