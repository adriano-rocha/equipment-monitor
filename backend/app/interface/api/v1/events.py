"""Rotas de eventos com suporte à Cerca Virtual e Coordenadas."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.application.exceptions import EventNotFoundError
from app.application.services.event_service import EventService
from app.infrastructure.db.repositories.sqlalchemy_event_repository import (
    SqlAlchemyEventRepository,
)
from app.interface.api.v1.schemas.event_schema import (
    EventCreate,
    EventResponse,
    EventUpdate,
)
from app.interface.deps import get_current_user, get_db_session

router = APIRouter(
    dependencies=[Depends(get_current_user)],
)


def _get_event_service(session: Session) -> EventService:
    return EventService(
        event_repository=SqlAlchemyEventRepository(session),
    )


def _to_response(event) -> EventResponse:
    """Helper unificado para converter a entidade de domínio em schema HTTP."""
    return EventResponse(
        id=event.id,
        name=event.name,
        location=event.location,
        latitude=event.latitude,
        longitude=event.longitude,
        geofence_radius=event.geofence_radius or 250.0,
        geofence_polygon=getattr(event, "geofence_polygon", None),
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        is_active=event.is_active,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    session: Session = Depends(get_db_session),
) -> EventResponse:
    service = _get_event_service(session)

    event = service.create(
        name=payload.name,
        location=payload.location,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        is_active=payload.is_active,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geofence_radius=payload.geofence_radius,
        geofence_polygon=payload.geofence_polygon,
    )

    session.commit()
    return _to_response(event)


@router.get("/events", response_model=list[EventResponse])
def list_events(
    starts_at: datetime | None = Query(default=None),
    ends_at: datetime | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    session: Session = Depends(get_db_session),
) -> list[EventResponse]:
    service = _get_event_service(session)

    events = service.list_by_period(
        starts_at=starts_at,
        ends_at=ends_at,
        is_active=is_active,
    )

    return [_to_response(event) for event in events]


@router.get("/events/{event_id}", response_model=EventResponse)
def get_event(
    event_id: UUID,
    session: Session = Depends(get_db_session),
) -> EventResponse:
    service = _get_event_service(session)
    event = service.get_by_id(event_id)

    if event is None:
        raise EventNotFoundError()

    return _to_response(event)


@router.patch("/events/{event_id}", response_model=EventResponse)
def update_event(
    event_id: UUID,
    payload: EventUpdate,
    session: Session = Depends(get_db_session),
) -> EventResponse:
    service = _get_event_service(session)

    event = service.update(
        event_id=event_id,
        name=payload.name,
        location=payload.location,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        is_active=payload.is_active,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geofence_radius=payload.geofence_radius,
        geofence_polygon=payload.geofence_polygon,
    )

    session.commit()
    return _to_response(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: UUID,
    session: Session = Depends(get_db_session),
) -> None:
    service = _get_event_service(session)
    service.delete(event_id)
    session.commit()