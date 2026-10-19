from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.application.services.device_status_service import (
    calculate_communication_status,
)
from app.infrastructure.config import get_settings
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)
from app.interface.api.v1.schemas.device_schema import DeviceResponse
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