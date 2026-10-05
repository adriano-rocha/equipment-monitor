"""Rotas HTTP para associações entre eventos e equipamentos da Fase 06."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
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
    EventDeviceResponsibleUpdate,
)
from app.interface.deps import get_db_session

router = APIRouter()


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
    """Associa um equipamento a um evento."""
    service = _get_event_device_service(session)

    event_device = service.add_device(
        event_id=event_id,
        device_id=payload.device_id,
        assigned_user_id=payload.assigned_user_id,
    )

    return _to_response(event_device)


@router.get(
    "/events/{event_id}/devices",
    response_model=list[EventDeviceResponse],
)
def list_event_devices(
    event_id: UUID,
    session: Session = Depends(get_db_session),
) -> list[EventDeviceResponse]:
    """Lista o histórico de equipamentos associados ao evento."""
    service = _get_event_device_service(session)

    event_devices = service.list_by_event(event_id)

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
def assign_device_responsible(
    event_id: UUID,
    device_id: UUID,
    payload: EventDeviceResponsibleUpdate,
    session: Session = Depends(get_db_session),
) -> EventDeviceResponse:
    """Troca o responsável de um equipamento dentro do evento."""
    service = _get_event_device_service(session)

    event_device = service.assign_responsible(
        event_id=event_id,
        device_id=device_id,
        user_id=payload.assigned_user_id,
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