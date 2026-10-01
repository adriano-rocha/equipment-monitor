"""Monitor periódico dos estados de comunicação dos devices."""

import asyncio
import logging

from app.application.services.device_status_service import (
    calculate_communication_status,
)
from app.application.services.status_event_service import StatusEventService
from app.infrastructure.config import Settings
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.notifications.telegram_service import TelegramService
from app.interface.realtime.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)


class StatusMonitor:
    def __init__(
        self,
        *,
        settings: Settings,
        websocket_manager: WebSocketManager,
        telegram_service: TelegramService,
    ) -> None:
        self._settings = settings
        self._websocket_manager = websocket_manager
        self._telegram_service = telegram_service
        self._event_service = StatusEventService()

        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        """Inicia o monitor sem bloquear o startup da aplicação."""

        if self._task is not None:
            return

        self._running = True

        self._task = asyncio.create_task(
            self._run(),
            name="equipment-monitor-status-monitor",
        )

        logger.info("Status monitor iniciado.")

    async def stop(self) -> None:
        """Encerra o monitor e sua task de background."""

        self._running = False

        if self._task is None:
            return

        self._task.cancel()

        try:
            await self._task
        except asyncio.CancelledError:
            pass

        self._task = None

        logger.info("Status monitor finalizado.")

    async def _run(self) -> None:
        interval = self._settings.heartbeat_interval_seconds

        while self._running:
            try:
                await self._check_devices()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception(
                    "Erro durante verificação de status. "
                    "O monitor continuará no próximo ciclo."
                )

            await asyncio.sleep(interval)

    async def _check_devices(self) -> None:
        session = SessionLocal()

        try:
            repository = SqlAlchemyDeviceRepository(session)
            devices = repository.list_all()

            active_device_ids = {device.id for device in devices}

            self._event_service.remove_missing_devices(
                active_device_ids
            )

            for device in devices:
                current_status = calculate_communication_status(
                    device.last_seen,
                    self._settings,
                )

                event = self._event_service.process(
                    device_id=device.id,
                    asset_number=device.asset_number,
                    status=current_status,
                )

                if event is None:
                    continue

                payload = event.to_dict()

                await self._websocket_manager.broadcast(payload)

                await self._telegram_service.send_status_change(event)

        finally:
            session.close()