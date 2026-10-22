"""Rotas HTTP para associações entre eventos e equipamentos."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.application.services.event_device_service import EventDeviceService
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_event_device_repository import (
    SqlAlchemyEventDeviceRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_event_repository import (
    SqlAlchemyEventRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_user_repository import (
    SqlAlchemyUserRepository,
)
from app.interface.api.v1.schemas.event_device_schema import (
    EventDeviceCreate,
    EventDeviceResponse,
    EventDeviceUpdate,
)
from app.interface.deps import get_current_user, get_db_session

router = APIRouter(
    dependencies=[Depends(get_current_user)],
)


def _get_event_device_service(session: Session) -> EventDeviceService:
    """Cria o serviço de associações com seus repositórios concretos."""
    return EventDeviceService(
        event_repository=SqlAlchemyEventRepository(session),
        device_repository=SqlAlchemyDeviceRepository(session),
        event_device_repository=SqlAlchemyEventDeviceRepository(session),
        user_repository=SqlAlchemyUserRepository(session),
    )


def _to_response(event_device) -> EventDeviceResponse:
    """Converte a entidade de domínio para o schema HTTP."""
    return EventDeviceResponse(
        id=event_device.id,
        event_id=event_device.event_id,
        device_id=event_device.device_id,
        location_point=event_device.location_point,
        assigned_user_id=event_device.assigned_user_id,
        assigned_at=event_device.assigned_at,
        unassigned_at=event_device.unassigned_at,
        created_at=event_device.created_at,
        updated_at=event_device.updated_at,
        is_active=event_device.is_active,
    )


@router.post(
    "/events/{event_id}/devices",
    response_model=EventDeviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_device_to_event(
    event_id: UUID,
    payload: EventDeviceCreate,
    session: Session = Depends(get_db_session),
) -> EventDeviceResponse:
    """Associa um equipamento a um evento com ponto físico e responsável opcional."""
    service = _get_event_device_service(session)

    event_device = service.add_device(
        event_id=event_id,
        device_id=payload.device_id,
        location_point=payload.location_point,
        assigned_user_id=payload.assigned_user_id,
    )

    return _to_response(event_device)


@router.get(
    "/events/{event_id}/devices",
    response_model=list[EventDeviceResponse],
)
def list_event_devices(
    event_id: UUID,
    active_only: bool = Query(default=False),
    session: Session = Depends(get_db_session),
) -> list[EventDeviceResponse]:
    """Lista equipamentos associados ao evento (histórico completo ou apenas ativos)."""
    service = _get_event_device_service(session)

    event_devices = service.list_by_event(event_id, active_only=active_only)

    return [_to_response(item) for item in event_devices]


@router.get(
    "/devices/{device_id}/events",
    response_model=list[EventDeviceResponse],
)
def list_device_events(
    device_id: UUID,
    session: Session = Depends(get_db_session),
) -> list[EventDeviceResponse]:
    """Lista o histórico de eventos de um equipamento."""
    service = _get_event_device_service(session)

    event_devices = service.list_by_device(device_id)

    return [_to_response(item) for item in event_devices]


@router.patch(
    "/events/{event_id}/devices/{device_id}",
    response_model=EventDeviceResponse,
)
def update_device_in_event(
    event_id: UUID,
    device_id: UUID,
    payload: EventDeviceUpdate,
    session: Session = Depends(get_db_session),
) -> EventDeviceResponse:
    """Altera o ponto físico e/ou o responsável no evento mantendo histórico de auditoria."""
    service = _get_event_device_service(session)

    event_device = service.update_assignment(
        event_id=event_id,
        device_id=device_id,
        location_point=payload.location_point,
        assigned_user_id=payload.assigned_user_id,
        clear_user=payload.clear_user,
    )

    return _to_response(event_device)


@router.delete(
    "/events/{event_id}/devices/{device_id}",
    response_model=EventDeviceResponse,
)
def remove_device_from_event(
    event_id: UUID,
    device_id: UUID,
    session: Session = Depends(get_db_session),
) -> EventDeviceResponse:
    """Encerra a associação ativa entre equipamento e evento."""
    service = _get_event_device_service(session)

    event_device = service.remove_device(
        event_id=event_id,
        device_id=device_id,
    )

    return _to_response(event_device)