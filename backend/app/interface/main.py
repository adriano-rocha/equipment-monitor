"""Ponto de entrada da API (uvicorn app.interface.main:app)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.application.exceptions import InvalidDeviceCredentialsError
from app.interface.api.v1.devices import router as devices_router
from app.interface.api.v1.heartbeats import router as heartbeats_router
from app.interface.error_handlers import invalid_device_credentials_handler

app = FastAPI(title="Equipment Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(heartbeats_router, prefix="/api/v1", tags=["heartbeats"])
app.include_router(devices_router, prefix="/api/v1", tags=["devices"])

app.add_exception_handler(
    InvalidDeviceCredentialsError,
    invalid_device_credentials_handler,
)