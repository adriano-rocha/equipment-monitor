"""Rota POST /api/v1/heartbeats com Cerca Virtual Dinâmica e Conformidade LGPD."""

from datetime import datetime, timezone
import json
import logging
from uuid import UUID

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

logger = logging.getLogger("equipment_monitor.heartbeats")
router = APIRouter()

# Constantes de Negócio e Telemetria
CRITICAL_BATTERY_THRESHOLD = 10.0
HIGH_SPEED_THRESHOLD_KMH = 25.0
MAX_ALLOWED_ACCURACY_METERS = 45.0  # Precisões piores que 45m são ruído indoor e não geram evasão

# Controle em memória de estado para disparo por transição (Edge-Triggered) com Histerese
_active_breaches: set[UUID] = set()
_breach_candidate_counts: dict[UUID, int] = {}
_active_battery_alerts: set[UUID] = set()


async def _safe_broadcast(message: dict) -> None:
    """Envia mensagem WebSocket com captura de erro para não impactar o retorno HTTP."""
    try:
        await websocket_manager.broadcast(message)
    except Exception as exc:
        logger.warning("Falha no broadcast WebSocket: %s", exc)


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
    device_id = authenticated.device.id

    # 1. Registro em log estritamente anônimo e sem dados pessoais de geolocalização (LGPD)
    logger.info(
        "Heartbeat recebido para dispositivo: %s (IP: %s)",
        device_id,
        request.client.host if request.client else "unknown",
    )

    # 2. Persistência da telemetria através do caso de uso
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

    # 3. Regra de Bateria Crítica com Deduplicação (Disparo único por transição)
    if payload.battery_level is not None:
        battery_val = float(payload.battery_level)
        if battery_val <= CRITICAL_BATTERY_THRESHOLD:
            if device_id not in _active_battery_alerts:
                _active_battery_alerts.add(device_id)
                alert_service = AlertService(
                    websocket_manager=websocket_manager,
                    telegram_service=TelegramService(get_settings()),
                )
                await alert_service.trigger_battery_critical(
                    session=session,
                    device_id=device_id,
                    asset_number=authenticated.device.asset_number,
                    battery_level=battery_val,
                )
        else:
            _active_battery_alerts.discard(device_id)

    # 4. Avaliação de Cerca Virtual Dinâmica com Filtro de Precisão e Histerese
    if payload.latitude is not None and payload.longitude is not None:
        active_assignment = (
            session.query(EventDeviceModel)
            .filter(
                EventDeviceModel.device_id == device_id,
                EventDeviceModel.unassigned_at.is_(None),
            )
            .first()
        )

        if active_assignment:
            event = (
                session.query(EventModel)
                .filter(
                    EventModel.id == active_assignment.event_id,
                    EventModel.is_active.is_(True),
                )
                .first()
            )

            if event and (
                (event.latitude is not None and event.longitude is not None)
                or getattr(event, "geofence_polygon", None)
            ):
                event_center = (
                    (event.latitude, event.longitude)
                    if event.latitude is not None and event.longitude is not None
                    else None
                )
                event_radius = float(event.geofence_radius or 250.0)

                # Tratamento defensivo do polígono
                polygon_data = getattr(event, "geofence_polygon", None)
                if isinstance(polygon_data, str):
                    try:
                        polygon_data = json.loads(polygon_data)
                    except Exception as parse_err:
                        logger.warning(
                            "Falha ao decodificar geofence_polygon do evento %s: %s",
                            event.id,
                            parse_err,
                        )
                        polygon_data = None

                dentro, distancia = GeofenceService.validar_perimetro(
                    device_coords=(float(payload.latitude), float(payload.longitude)),
                    venue_center=event_center,
                    raio_maximo_metros=event_radius,
                    geofence_polygon=polygon_data,
                )

                # Extrai precisão (do payload ou de dentro do metadata)
                raw_accuracy = getattr(payload, "accuracy", None)
                if raw_accuracy is None and payload.metadata:
                    raw_accuracy = payload.metadata.get("accuracy")
                accuracy_m = float(raw_accuracy) if raw_accuracy is not None else None

                # FILTRO DE PRECISÃO: Se precisão > 45m, é sinal degradado de dentro do pavilhão
                is_accuracy_unreliable = (
                    accuracy_m is not None and accuracy_m > MAX_ALLOWED_ACCURACY_METERS
                )

                speed = float(payload.speed_kmh or 0.0)
                is_high_speed = speed > HIGH_SPEED_THRESHOLD_KMH

                logger.info(
                    "[GEOFENCE AUDIT] Device: %s | Modo: %s | Dentro: %s | Accuracy: %sm | Dist: %.1fm",
                    authenticated.device.asset_number,
                    "POLIGONAL" if (polygon_data and len(polygon_data) >= 3) else "CIRCULAR_LEGADO",
                    dentro,
                    accuracy_m if accuracy_m is not None else "N/A",
                    distancia,
                )

                # -----------------------------------------------------------------
                # Caso 1: DISPOSITIVO FORA DA CERCA COM SINAL CONFIÁVEL
                # -----------------------------------------------------------------
                if not dentro and not is_accuracy_unreliable:
                    # Histerese: Exige 2 heartbeats consecutivos fora para confirmar fuga
                    current_count = _breach_candidate_counts.get(device_id, 0) + 1
                    _breach_candidate_counts[device_id] = current_count

                    if current_count >= 2:
                        is_new_breach = device_id not in _active_breaches
                        _active_breaches.add(device_id)

                        reason = (
                            "HIGH_SPEED_EVASION" if is_high_speed else "PERIMETER_BREACH"
                        )
                        msg = (
                            f"🚨 ALERTA CRÍTICO: Dispositivo {authenticated.device.asset_number} "
                            f"em evasão rápida ({speed:.1f} km/h a {distancia:.1f}m da base)!"
                            if is_high_speed
                            else f"🚨 O dispositivo {authenticated.device.asset_number} rompeu o perímetro "
                            f"do evento {event.name}!"
                        )

                        alert_payload = {
                            "type": "ALERT_TRIGGERED" if is_new_breach else "DEVICE_POSITION_UPDATED",
                            "event": "alert_triggered" if is_new_breach else "position_updated",
                            "device_id": str(device_id),
                            "asset_number": authenticated.device.asset_number,
                            "event_name": event.name,
                            "event_id": str(event.id),
                            "location_point": active_assignment.location_point or "Posto Operacional",
                            "reason": reason,
                            "message": msg,
                            "latitude": float(payload.latitude),
                            "longitude": float(payload.longitude),
                            "speed_kmh": speed,
                            "distance_m": float(distancia),
                            "is_breached": True,
                        }

                        await _safe_broadcast(alert_payload)

                        # Disparo único de Telegram em caso de rompimento confirmado
                        if is_new_breach:
                            try:
                                telegram_service = TelegramService(get_settings())
                                if hasattr(telegram_service, "send_alert"):
                                    await telegram_service.send_alert(msg)
                                elif hasattr(telegram_service, "send_message"):
                                    await telegram_service.send_message(msg)
                            except Exception as exc:
                                logger.warning("Falha ao despachar alerta Telegram: %s", exc)

                # -----------------------------------------------------------------
                # Caso 2: DISPOSITIVO DENTRO DA CERCA OU SINAL IMPRECISO (NORMAL)
                # -----------------------------------------------------------------
                else:
                    _breach_candidate_counts.pop(device_id, None)
                    was_breached = device_id in _active_breaches
                    _active_breaches.discard(device_id)

                    normal_payload = {
                        "type": "DEVICE_RETURNED_TO_FENCE" if was_breached else "DEVICE_POSITION_UPDATED",
                        "device_id": str(device_id),
                        "asset_number": authenticated.device.asset_number,
                        "latitude": float(payload.latitude),
                        "longitude": float(payload.longitude),
                        "speed_kmh": speed,
                        "distance_m": float(distancia),
                        "is_breached": False,
                    }

                    await _safe_broadcast(normal_payload)

    return HeartbeatResponse(
        id=heartbeat.id,
        device_id=heartbeat.device_id,
        received_at=heartbeat.received_at,
    )