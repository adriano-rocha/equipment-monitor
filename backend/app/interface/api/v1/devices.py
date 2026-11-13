from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.infrastructure.db.models.device_model import DeviceModel

from app.application.use_cases.delete_device_use_case import DeleteDeviceUseCase
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

from app.application.use_cases.delete_device_use_case import DeleteDeviceUseCase
from app.application.use_cases.update_device_use_case import (
    UpdateDeviceInput,
    UpdateDeviceUseCase,
)

from app.interface.api.v1.schemas.device_schema import (
    DeviceCheckinRequest,
    DeviceCheckinResponse,
    DeviceCreateRequest,
    DeviceCreateResponse,
    DeviceCredentialsResponse,
    DeviceResponse,
    DeviceUpdateRequest,
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
            operational_state=getattr(device, "operational_state", "ATIVO") or "ATIVO",
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
        operational_state=device.operational_state,
        last_seen=device.last_seen,
        status=calculate_communication_status(device.last_seen, settings),
        credentials=DeviceCredentialsResponse(
            key_id=result.key_id,
            secret=result.secret,
        ),
    )

@router.patch("/devices/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: UUID,
    payload: DeviceUpdateRequest,
    session: Session = Depends(get_db_session),
) -> DeviceResponse:
    device_repo = SqlAlchemyDeviceRepository(session)
    use_case = UpdateDeviceUseCase(device_repository=device_repo)

    device = use_case.execute(
        UpdateDeviceInput(
            device_id=device_id,
            asset_number=payload.asset_number,
            device_type=payload.device_type,
            manufacturer=payload.manufacturer,
            model=payload.model,
            serial_number=payload.serial_number,
            operational_state=payload.operational_state,
        )
    )

    settings = get_settings()
    return DeviceResponse(
        id=device.id,
        asset_number=device.asset_number,
        device_type=device.device_type,
        manufacturer=device.manufacturer,
        model=device.model,
        serial_number=device.serial_number,
        hostname=device.hostname,
        reported_ip=device.reported_ip,
        battery_level=device.battery_level,
        operational_state=device.operational_state,
        last_seen=device.last_seen,
        status=calculate_communication_status(device.last_seen, settings),
    )


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: UUID,
    session: Session = Depends(get_db_session),
) -> Response:
    device_repo = SqlAlchemyDeviceRepository(session)
    credential_repo = SqlAlchemyDeviceCredentialRepository(session)
    use_case = DeleteDeviceUseCase(
        device_repository=device_repo,
        credential_repository=credential_repo,
    )

    use_case.execute(device_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/devices/undo-checkin", response_model=DeviceCheckinResponse)
def undo_checkin_device(
    payload: DeviceCheckinRequest,
    session: Session = Depends(get_db_session),
) -> DeviceCheckinResponse:
    raw_code = payload.asset_code.strip()

    device = (
        session.query(DeviceModel)
        .filter(
            DeviceModel.asset_number == raw_code,
            DeviceModel.deleted_at.is_(None),
        )
        .with_for_update()
        .first()
    )

    if not device and len(raw_code) == 4 and raw_code.isdigit():
        device = (
            session.query(DeviceModel)
            .filter(
                DeviceModel.asset_number.endswith(raw_code),
                DeviceModel.deleted_at.is_(None),
            )
            .with_for_update()
            .first()
        )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispositivo com patrimônio ou final '{raw_code}' não foi encontrado.",
        )

    device.operational_state = "ATIVO"
    session.commit()
    session.refresh(device)

    return DeviceCheckinResponse(
        id=device.id,
        asset_number=device.asset_number,
        device_type=device.device_type,
        model=device.model,
        operational_state="ATIVO",
        already_collected=False,
        message=f"Equipamento {device.asset_number} reativado e retornado ao posto com sucesso!",
    )


@router.post("/devices/checkin", response_model=DeviceCheckinResponse)
def checkin_device(
    payload: DeviceCheckinRequest,
    session: Session = Depends(get_db_session),
) -> DeviceCheckinResponse:
    """Check-in Express: localiza por patrimônio exato ou 4 dígitos finais e marca como RECOLHIDO."""
    raw_code = payload.asset_code.strip()

    # 1. Busca exata (ex: 'NOTE-0142' ou '0142')
    device = (
        session.query(DeviceModel)
        .filter(
            DeviceModel.asset_number == raw_code,
            DeviceModel.deleted_at.is_(None),
        )
        .with_for_update()
        .first()
    )

    # 2. Fallback inteligente: se digitou apenas os 4 dígitos finais (ex: '0142' para 'PAT-0142')
    if not device and len(raw_code) >= 3:
        device = (
            session.query(DeviceModel)
            .filter(
                DeviceModel.asset_number.endswith(raw_code),
                DeviceModel.deleted_at.is_(None),
            )
            .with_for_update()
            .first()
        )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dispositivo com patrimônio ou final '{raw_code}' não foi encontrado.",
        )

    already_collected = (device.operational_state == "RECOLHIDO")

    if not already_collected:
        device.operational_state = "RECOLHIDO"
        session.commit()
        session.refresh(device)

    msg = (
        f"Patrimônio {device.asset_number} já estava recolhido."
        if already_collected
        else f"Check-in concluído! {device.asset_number} marcado como RECOLHIDO."
    )

    return DeviceCheckinResponse(
        id=device.id,
        asset_number=device.asset_number,
        device_type=device.device_type,
        model=device.model,
        operational_state=device.operational_state,
        already_collected=already_collected,
        message=msg,
    )