"""Rota POST /api/v1/heartbeats (SPEC-001)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.application.use_cases.register_heartbeat import RegisterHeartbeatCommand, RegisterHeartbeatUseCase
from app.infrastructure.auth.device_auth_service import AuthenticatedDevice
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import SqlAlchemyDeviceRepository
from app.infrastructure.db.repositories.sqlalchemy_heartbeat_repository import SqlAlchemyHeartbeatRepository
from app.interface.api.v1.schemas.heartbeat_schema import HeartbeatRequest, HeartbeatResponse
from app.interface.deps import get_current_device, get_db_session

router = APIRouter()


@router.post("/heartbeats", status_code=status.HTTP_201_CREATED, response_model=HeartbeatResponse)
def register_heartbeat(
    payload: HeartbeatRequest,
    request: Request,
    authenticated: AuthenticatedDevice = Depends(get_current_device),
    session: Session = Depends(get_db_session),
) -> HeartbeatResponse:
    use_case = RegisterHeartbeatUseCase(
        device_repository=SqlAlchemyDeviceRepository(session),
        credential_repository=SqlAlchemyDeviceCredentialRepository(session),
        heartbeat_repository=SqlAlchemyHeartbeatRepository(session),
    )

    command = RegisterHeartbeatCommand(
        device=authenticated.device,
        credential=authenticated.credential,
        received_at=datetime.now(timezone.utc),
        source_ip=request.client.host if request.client else "unknown",
        hostname=payload.hostname,
        reported_ip=payload.reported_ip,
        battery_level=payload.battery_level,
        metadata=payload.metadata,
        device_timestamp=payload.device_timestamp,
    )

    heartbeat = use_case.execute(command)

    return HeartbeatResponse(id=heartbeat.id, device_id=heartbeat.device_id, received_at=heartbeat.received_at)