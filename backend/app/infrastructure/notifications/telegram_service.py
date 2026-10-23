"""Integração de notificações com Telegram."""

import logging

import httpx

from app.application.services.status_event_service import DeviceStatusChangedEvent
from app.infrastructure.config import Settings

logger = logging.getLogger(__name__)


class TelegramService:
    def __init__(self, settings: Settings) -> None:
        self._token = settings.telegram_bot_token
        self._chat_id = settings.telegram_chat_id

    @property
    def enabled(self) -> bool:
        return bool(self._token and self._chat_id)

    async def send_battery_alert(
        self,
        *,
        asset_number: str,
        battery_level: float,
        event_name: str | None = None,
        location_point: str | None = None,
        responsible_name: str | None = None,
    ) -> None:
        """Envia alerta de bateria crítica (<= 10%) para troca preventiva imediata."""
        if not self.enabled:
            return

        lines = [
            "🔋⚠️ <b>ALERTA: BATERIA CRÍTICA (≤10%)</b> ⚠️🔋",
            "",
            f"📱 <b>Equipamento:</b> {asset_number}",
            f"⚡ <b>Nível Atual:</b> {battery_level:.0f}%",
        ]

        if event_name:
            lines.append(f"🎪 <b>Evento:</b> {event_name}")
        if location_point:
            lines.append(f"📍 <b>Ponto Físico:</b> {location_point}")
        if responsible_name:
            lines.append(f"👤 <b>Responsável:</b> {responsible_name}")

        lines.extend([
            "",
            "🚨 <i>Ação recomendada: Substituir o equipamento no ponto pelo Dashboard.</i>"
        ])

        message = "\n".join(lines)
        url = f"https://api.telegram.org/bot{self._token}/sendMessage"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    url,
                    json={
                        "chat_id": self._chat_id,
                        "text": message,
                        "parse_mode": "HTML",
                    },
                )
        except Exception:
            logger.exception("Falha ao enviar alerta de bateria Telegram (Dashboard já notificado).")

    async def send_status_change(
        self,
        event: DeviceStatusChangedEvent,
    ) -> None:
        if not self.enabled:
            logger.debug("Telegram não configurado; notificação ignorada.")
            return

        message = (
            "🔔 Equipment Monitor\n\n"
            f"Patrimônio: {event.asset_number}\n"
            f"Status anterior: {event.previous_status}\n"
            f"Novo status: {event.status}\n"
            f"Horário: {event.timestamp.isoformat()}"
        )

        url = f"https://api.telegram.org/bot{self._token}/sendMessage"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    json={
                        "chat_id": self._chat_id,
                        "text": message,
                    },
                )
                response.raise_for_status()

        except Exception:
            # Telegram é secundário. Nunca deve derrubar o monitor.
            logger.exception(
                "Falha ao enviar notificação Telegram para o device %s.",
                event.device_id,
            )