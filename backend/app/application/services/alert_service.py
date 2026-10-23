"""Serviço de alerta operacional em tempo real (Dashboard e Telegram)."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.infrastructure.db.models.event_device_model import EventDeviceModel
from app.infrastructure.db.models.event_model import EventModel
from app.infrastructure.db.models.user_model import UserModel
from app.infrastructure.notifications.telegram_service import TelegramService
from app.interface.realtime.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)


class AlertService:
    def __init__(
        self,
        *,
        websocket_manager: WebSocketManager,
        telegram_service: TelegramService,
    ) -> None:
        self._websocket_manager = websocket_manager
        self._telegram_service = telegram_service

    async def trigger_battery_critical(
        self,
        *,
        session: Session,
        device_id: UUID,
        asset_number: str,
        battery_level: float,
    ) -> dict:
        """
        Dispara alerta imediato de bateria crítica (<= 10%) para a tela do Dashboard e Telegram.
        Identifica se o equipamento está em operação ativa em algum evento/posto.
        """
        event_name = None
        location_point = None
        responsible_name = None
        event_id = None

        try:
            row = (
                session.query(EventDeviceModel, EventModel, UserModel)
                .join(EventModel, EventModel.id == EventDeviceModel.event_id)
                .outerjoin(UserModel, UserModel.id == EventDeviceModel.assigned_user_id)
                .filter(
                    EventDeviceModel.device_id == device_id,
                    EventDeviceModel.unassigned_at.is_(None),
                )
                .first()
            )
            if row:
                event_device, event, user = row
                event_id = str(event_device.event_id)
                event_name = event.name
                location_point = event_device.location_point
                responsible_name = user.name if user else None
        except Exception:
            logger.warning(
                "Falha ao buscar alocação de evento para alerta de bateria do device %s",
                device_id,
                exc_info=True,
            )

        alert_payload = {
            "type": "ALERT_TRIGGERED",
            "reason": "BATTERY_CRITICAL",
            "severity": "CRITICAL",
            "device_id": str(device_id),
            "asset_number": asset_number,
            "battery_level": float(battery_level),
            "event_id": event_id,
            "event_name": event_name,
            "location_point": location_point,
            "responsible_name": responsible_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # 1. Prioridade máxima: Broadcast na tela do Dashboard
        await self._websocket_manager.broadcast(alert_payload)

        # 2. Canal secundário: Telegram (se falhar, não derruba o fluxo)
        try:
            await self._telegram_service.send_battery_alert(
                asset_number=asset_number,
                battery_level=float(battery_level),
                event_name=event_name,
                location_point=location_point,
                responsible_name=responsible_name,
            )
        except Exception:
            logger.warning("Telegram indisponível no envio de bateria crítica (Dashboard notificado).")

        return alert_payload