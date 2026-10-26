"""Ponto de entrada da API (uvicorn app.interface.main:app)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.application.exceptions import (
    DeviceAlreadyExistsError,
    DeviceNotFoundError,
    EventDeviceAlreadyActiveError,
    EventDeviceNotFoundError,
    EventNotFoundError,
    InvalidDeviceCredentialsError,
    UserNotFoundError,
)
from app.application.services.status_monitor import StatusMonitor
from app.infrastructure.config import get_settings
from app.infrastructure.notifications.telegram_service import TelegramService
from app.interface.api.v1.devices import router as devices_router
from app.interface.api.v1.event_devices import router as event_devices_router
from app.interface.api.v1.events import router as events_router
from app.interface.api.v1.heartbeats import router as heartbeats_router
from app.interface.api.v1.realtime import router as realtime_router
from app.interface.api.v1.users import router as users_router
from app.interface.api.v1 import auth
from app.interface.error_handlers import (
    device_already_exists_handler,
    device_not_found_handler,
    event_device_already_active_handler,
    event_device_not_found_handler,
    event_not_found_handler,
    invalid_device_credentials_handler,
    user_not_found_handler,
)
from app.interface.realtime.websocket_manager import websocket_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida dos serviços de background da aplicação."""

    settings = get_settings()

    telegram_service = TelegramService(settings)

    status_monitor = StatusMonitor(
        settings=settings,
        websocket_manager=websocket_manager,
        telegram_service=telegram_service,
    )

    await status_monitor.start()

    app.state.status_monitor = status_monitor
    app.state.telegram_service = telegram_service

    try:
        yield
    finally:
        await status_monitor.stop()


app = FastAPI(
    title="Equipment Monitor API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://asaph-equipment-control.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    heartbeats_router,
    prefix="/api/v1",
    tags=["heartbeats"],
)

app.include_router(
    devices_router,
    prefix="/api/v1",
    tags=["devices"],
)

app.include_router(
    events_router,
    prefix="/api/v1",
    tags=["events"],
)

app.include_router(
    users_router,
    prefix="/api/v1",
    tags=["users"],
)

app.include_router(
    event_devices_router,
    prefix="/api/v1",
    tags=["event-devices"],
)

app.include_router(
    realtime_router,
    prefix="/api/v1",
    tags=["realtime"],
)

app.include_router(
    auth.router, 
    prefix="/api/v1", 
    tags=["Autenticação"]
)

app.add_exception_handler(
    InvalidDeviceCredentialsError,
    invalid_device_credentials_handler,
)

app.add_exception_handler(
    EventNotFoundError,
    event_not_found_handler,
)

app.add_exception_handler(
    DeviceNotFoundError,
    device_not_found_handler,
)

app.add_exception_handler(
    UserNotFoundError,
    user_not_found_handler,
)

app.add_exception_handler(
    EventDeviceNotFoundError,
    event_device_not_found_handler,
)

app.add_exception_handler(
    EventDeviceAlreadyActiveError,
    event_device_already_active_handler,
)

app.add_exception_handler(
    DeviceAlreadyExistsError,
    device_already_exists_handler,
)