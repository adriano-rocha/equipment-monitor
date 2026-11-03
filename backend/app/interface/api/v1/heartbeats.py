"""Rota POST /api/v1/heartbeats (SPEC-001) com Cerca Virtual Dinâmica."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.application.services.alert_service import AlertService
from app.application.services.geofence_service import GeofenceService
from app.application.use_cases.register_heartbeat import (
    RegisterHeartbeatCommand,
    RegisterHeartbeatUseCase,
)
from app.infrastructure.auth.device_auth_service import AuthenticatedDevice
from app.infrastructure.config import get_settings
from app.infrastructure.db.models.event_device_model import EventDeviceModel
from app.infrastructure.db.models.event_model import EventModel
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_heartbeat_repository import (
    SqlAlchemyHeartbeatRepository,
)
from app.infrastructure.notifications.telegram_service import TelegramService
from app.interface.api.v1.schemas.heartbeat_schema import (
    HeartbeatRequest,
    HeartbeatResponse,
)
from app.interface.deps import get_current_device, get_db_session
from app.interface.realtime.websocket_manager import websocket_manager

router = APIRouter()


@router.post(
    "/heartbeats",
    status_code=status.HTTP_201_CREATED,
    response_model=HeartbeatResponse,
)
async def register_heartbeat(
    payload: HeartbeatRequest,
    request: Request,
    authenticated: AuthenticatedDevice = Depends(get_current_device),
    session: Session = Depends(get_db_session),
) -> HeartbeatResponse:
    print(
        f"\n🚨 [ROTA ACIONADA] Aparelho: {authenticated.device.asset_number} | "
        f"Lat: {payload.latitude} | Lon: {payload.longitude} | Speed: {payload.speed_kmh} km/h",
        flush=True,
    )

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
    session.commit()

    # --- 1. REGRA DE BATERIA CRÍTICA (<= 10%) ---
    if payload.battery_level is not None and payload.battery_level <= 10.0:
        alert_service = AlertService(
            websocket_manager=websocket_manager,
            telegram_service=TelegramService(get_settings()),
        )
        await alert_service.trigger_battery_critical(
            session=session,
            device_id=authenticated.device.id,
            asset_number=authenticated.device.asset_number,
            battery_level=float(payload.battery_level),
        )

    # --- 2. REGRA DE CERCA VIRTUAL DINÂMICA VIA BANCO ---
    if payload.latitude is not None and payload.longitude is not None:
        # Busca se o aparelho possui alocação ativa em algum evento
        active_assignment = (
            session.query(EventDeviceModel)
            .filter(
                EventDeviceModel.device_id == authenticated.device.id,
                EventDeviceModel.unassigned_at.is_(None),
            )
            .first()
        )

        if not active_assignment:
            print(
                f"ℹ️ [CERCA DINÂMICA] Dispositivo {authenticated.device.asset_number} não está alocado a nenhum evento ativo.",
                flush=True,
            )
        else:
            event = (
                session.query(EventModel)
                .filter(
                    EventModel.id == active_assignment.event_id,
                    EventModel.is_active.is_(True),
                )
                .first()
            )

            if not event or event.latitude is None or event.longitude is None:
                print(
                    f"⚠️ [CERCA DINÂMICA] Evento {active_assignment.event_id} não possui coordenadas configuradas.",
                    flush=True,
                )
            else:
                event_center = (event.latitude, event.longitude)
                event_radius = float(event.geofence_radius or 250.0)

                dentro, distancia = GeofenceService.validar_perimetro(
                    device_coords=(payload.latitude, payload.longitude),
                    venue_center=event_center,
                    raio_maximo_metros=event_radius,
                )

                print(
                    f"📡 [CERCA DINÂMICA] Evento: {event.name} | Posto: {active_assignment.location_point} | "
                    f"Raio: {event_radius}m | Distância: {distancia}m | Dentro: {dentro}",
                    flush=True,
                )

                speed = float(payload.speed_kmh or 0.0)
                is_high_speed = speed > 25.0

                # CENÁRIO DE ALERTA: ROMPIMENTO OU EVASÃO RÁPIDA
                if not dentro:
                    # Se rompeu a cerca correndo/veículo -> HIGH_SPEED_EVASION
                    # Se rompeu a cerca caminhando -> PERIMETER_BREACH
                    if is_high_speed:
                        reason = "HIGH_SPEED_EVASION"
                        msg = (
                            f"🚨 ALERTA CRÍTICO: Dispositivo {authenticated.device.asset_number} "
                            f"em evasão rápida ({speed:.1f} km/h a {distancia:.1f}m da base)!"
                        )
                    else:
                        reason = "PERIMETER_BREACH"
                        msg = (
                            f"🚨 O dispositivo {authenticated.device.asset_number} rompeu o perímetro "
                            f"do evento {event.name}! ({distancia:.1f}m de distância)"
                        )

                    print(f"🚨 [DISPARO WEBSOCKET] {reason} | Distância: {distancia}m | Vel: {speed} km/h", flush=True)

                    await websocket_manager.broadcast({
                        "type": "ALERT_TRIGGERED",
                        "event": "alert_triggered",
                        "device_id": str(authenticated.device.id),
                        "asset_number": authenticated.device.asset_number,
                        "event_name": event.name,
                        "event_id": str(event.id),
                        "location_point": active_assignment.location_point or "Posto Operacional",
                        "reason": reason,
                        "message": msg,
                        # 👉 DADOS DE GEOLOCALIZAÇÃO COMPLETOS PARA O MAPA
                        "latitude": float(payload.latitude),
                        "longitude": float(payload.longitude),
                        "speed_kmh": speed,
                        "distance_m": float(distancia),
                    })

                else:
                    # CENÁRIO NORMAL: Atualiza a posição em tempo real dentro da cerca
                    await websocket_manager.broadcast({
                        "type": "DEVICE_POSITION_UPDATED",
                        "device_id": str(authenticated.device.id),
                        "asset_number": authenticated.device.asset_number,
                        "latitude": float(payload.latitude),
                        "longitude": float(payload.longitude),
                        "speed_kmh": speed,
                        "distance_m": float(distancia),
                    })

    return HeartbeatResponse(
        id=heartbeat.id,
        device_id=heartbeat.device_id,
        received_at=heartbeat.received_at,
    )