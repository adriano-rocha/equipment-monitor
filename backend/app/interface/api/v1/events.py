"""Rotas de eventos com suporte à Cerca Virtual e Coordenadas."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.application.exceptions import EventNotFoundError
from app.application.services.event_service import EventService
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.event_device_model import EventDeviceModel
from app.infrastructure.db.models.event_model import EventModel
from app.infrastructure.db.repositories.sqlalchemy_event_repository import (
    SqlAlchemyEventRepository,
)
from app.interface.api.v1.schemas.event_schema import (
    ClosureDeviceItem,
    EventCreate,
    EventClosureReportResponse,
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


@router.get(
    "/events/{event_id}/closure-report",
    response_model=EventClosureReportResponse,
)
def get_event_closure_report(
    event_id: UUID,
    session: Session = Depends(get_db_session),
) -> EventClosureReportResponse:
    """Gera o romaneio de fechamento com uma única leitura das alocações ativas."""
    statement = (
        select(
            EventModel.id.label("event_id"),
            EventModel.name.label("event_name"),
            DeviceModel.id.label("device_id"),
            DeviceModel.asset_number,
            DeviceModel.device_type,
            DeviceModel.model,
            EventDeviceModel.location_point,
            DeviceModel.battery_level,
            DeviceModel.operational_state,
            DeviceModel.last_seen,
        )
        .select_from(EventModel)
        .outerjoin(
            EventDeviceModel,
            and_(
                EventDeviceModel.event_id == EventModel.id,
                EventDeviceModel.unassigned_at.is_(None),
            ),
        )
        .outerjoin(DeviceModel, DeviceModel.id == EventDeviceModel.device_id)
        .where(EventModel.id == event_id)
        .order_by(DeviceModel.asset_number.asc())
    )
    rows = session.execute(statement).all()

    if not rows:
        raise EventNotFoundError()

    pending_devices: list[ClosureDeviceItem] = []
    collected_devices: list[ClosureDeviceItem] = []
    counts_by_type: dict[str, int] = {
        "notebook": 0,
        "smartphone": 0,
        "tablet": 0,
    }

    for row in rows:
        if row.device_id is None:
            continue

        device = ClosureDeviceItem(
            id=row.device_id,
            asset_number=row.asset_number,
            device_type=row.device_type,
            model=row.model,
            location_point=row.location_point,
            battery_level=row.battery_level,
            operational_state=row.operational_state,
            last_seen=row.last_seen,
        )
        device_type = (row.device_type or "unknown").strip().lower() or "unknown"
        counts_by_type[device_type] = counts_by_type.get(device_type, 0) + 1

        if row.operational_state == "RECOLHIDO":
            collected_devices.append(device)
        else:
            pending_devices.append(device)

    total_devices = len(pending_devices) + len(collected_devices)
    total_collected = len(collected_devices)

    return EventClosureReportResponse(
        event_id=rows[0].event_id,
        event_name=rows[0].event_name,
        generated_at=datetime.now(timezone.utc),
        total_devices=total_devices,
        total_collected=total_collected,
        total_pending=len(pending_devices),
        collection_rate_percent=(
            total_collected / total_devices * 100 if total_devices else 0.0
        ),
        counts_by_type=counts_by_type,
        pending_devices=pending_devices,
        collected_devices=collected_devices,
    )


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