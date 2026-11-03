"""Rotas de eventos da Fase 06 com suporte à Cerca Virtual e Coordenadas."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.application.exceptions import EventNotFoundError
from app.application.services.event_service import EventService
from app.infrastructure.db.models.event_model import EventModel
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


@router.post("/events", response_model=EventResponse, status_code=201)
def create_event(
    payload: EventCreate,
    session: Session = Depends(get_db_session),
) -> EventResponse:
    service = _get_event_service(session)

    # 1. Tenta criar pelo serviço passando as coordenadas
    try:
        event = service.create(
            name=payload.name,
            location=payload.location,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            is_active=payload.is_active,
            latitude=payload.latitude,
            longitude=payload.longitude,
            geofence_radius=payload.geofence_radius,
        )
    except TypeError:
        # Se a assinatura do service for legada, cria e atualiza diretamente no modelo
        event = service.create(
            name=payload.name,
            location=payload.location,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            is_active=payload.is_active,
        )

    # 2. Garante a persistência de latitude, longitude e geofence_radius no banco
    db_event = session.query(EventModel).filter_by(id=event.id).first()
    if db_event:
        if payload.latitude is not None:
            db_event.latitude = payload.latitude
        if payload.longitude is not None:
            db_event.longitude = payload.longitude
        if payload.geofence_radius is not None:
            db_event.geofence_radius = payload.geofence_radius
        session.commit()
        session.refresh(db_event)
        event = db_event

    return EventResponse(
        id=event.id,
        name=event.name,
        location=event.location,
        latitude=getattr(event, "latitude", None),
        longitude=getattr(event, "longitude", None),
        geofence_radius=getattr(event, "geofence_radius", 250.0) or 250.0,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        is_active=event.is_active,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.get("/events", response_model=list[EventResponse])
def list_events(
    starts_at: datetime | None = Query(default=None),
    ends_at: datetime | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    session: Session = Depends(get_db_session),
) -> list[EventResponse]:
    print("🔥 >>> O LIST_EVENTS DO ARQUIVO CERTO FOI CHAMADO! <<< 🔥")
    service = _get_event_service(session)

    events = service.list_by_period(
        starts_at=starts_at,
        ends_at=ends_at,
        is_active=is_active,
    )

    return [
        EventResponse(
            id=event.id,
            name=event.name,
            location=event.location,
            latitude=getattr(event, "latitude", None),
            longitude=getattr(event, "longitude", None),
            geofence_radius=getattr(event, "geofence_radius", 250.0) or 250.0,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            is_active=event.is_active,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
        for event in events
    ]


@router.get("/events/{event_id}", response_model=EventResponse)
def get_event(
    event_id: UUID,
    session: Session = Depends(get_db_session),
) -> EventResponse:
    service = _get_event_service(session)
    event = service.get_by_id(event_id)

    if event is None:
        raise EventNotFoundError()

    return EventResponse(
        id=event.id,
        name=event.name,
        location=event.location,
        latitude=getattr(event, "latitude", None),
        longitude=getattr(event, "longitude", None),
        geofence_radius=getattr(event, "geofence_radius", 250.0) or 250.0,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        is_active=event.is_active,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.patch("/events/{event_id}", response_model=EventResponse)
def update_event(
    event_id: UUID,
    payload: EventUpdate,
    session: Session = Depends(get_db_session),
) -> EventResponse:
    service = _get_event_service(session)

    try:
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
        )
    except TypeError:
        event = service.update(
            event_id=event_id,
            name=payload.name,
            location=payload.location,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            is_active=payload.is_active,
        )

    db_event = session.query(EventModel).filter_by(id=event_id).first()
    if db_event:
        if payload.latitude is not None:
            db_event.latitude = payload.latitude
        if payload.longitude is not None:
            db_event.longitude = payload.longitude
        if payload.geofence_radius is not None:
            db_event.geofence_radius = payload.geofence_radius
        session.commit()
        session.refresh(db_event)
        event = db_event

    return EventResponse(
        id=event.id,
        name=event.name,
        location=event.location,
        latitude=getattr(event, "latitude", None),
        longitude=getattr(event, "longitude", None),
        geofence_radius=getattr(event, "geofence_radius", 250.0) or 250.0,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        is_active=event.is_active,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: UUID,
    session: Session = Depends(get_db_session),
) -> None:
    service = _get_event_service(session)
    service.delete(event_id)
    session.commit()