from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.application.services.device_status_service import (
    calculate_communication_status,
)
from app.application.use_cases.create_device_use_case import (
    CreateDeviceInput,
    CreateDeviceUseCase,
)
from app.infrastructure.config import get_settings
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)
from app.interface.api.v1.schemas.device_schema import (
    DeviceCreateRequest,
    DeviceCreateResponse,
    DeviceCredentialsResponse,
    DeviceResponse,
)
from app.interface.deps import get_current_user, get_db_session

router = APIRouter(
    dependencies=[Depends(get_current_user)],
)


@router.get("/devices", response_model=list[DeviceResponse])
def list_devices(
    session: Session = Depends(get_db_session),
) -> list[DeviceResponse]:
    repository = SqlAlchemyDeviceRepository(session)
    settings = get_settings()
    devices = repository.list_all()

    return [
        DeviceResponse(
            id=device.id,
            asset_number=device.asset_number,
            device_type=device.device_type,
            manufacturer=device.manufacturer,
            model=device.model,
            serial_number=device.serial_number,
            hostname=device.hostname,
            reported_ip=device.reported_ip,
            battery_level=device.battery_level,
            last_seen=device.last_seen,
            status=calculate_communication_status(
                device.last_seen,
                settings,
            ),
        )
        for device in devices
    ]


@router.post(
    "/devices",
    response_model=DeviceCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device(
    payload: DeviceCreateRequest,
    session: Session = Depends(get_db_session),
) -> DeviceCreateResponse:
    device_repo = SqlAlchemyDeviceRepository(session)
    credential_repo = SqlAlchemyDeviceCredentialRepository(session)
    use_case = CreateDeviceUseCase(
        device_repository=device_repo,
        credential_repository=credential_repo,
    )

    result = use_case.execute(
        CreateDeviceInput(
            asset_number=payload.asset_number,
            device_type=payload.device_type,
            manufacturer=payload.manufacturer,
            model=payload.model,
            serial_number=payload.serial_number,
        )
    )

    settings = get_settings()
    device = result.device

    return DeviceCreateResponse(
        id=device.id,
        asset_number=device.asset_number,
        device_type=device.device_type,
        manufacturer=device.manufacturer,
        model=device.model,
        serial_number=device.serial_number,
        hostname=device.hostname,
        reported_ip=device.reported_ip,
        battery_level=device.battery_level,
        last_seen=device.last_seen,
        status=calculate_communication_status(device.last_seen, settings),
        credentials=DeviceCredentialsResponse(
            key_id=result.key_id,
            secret=result.secret,
        ),
    )