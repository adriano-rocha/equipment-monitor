"""Ponto de entrada da API (uvicorn app.interface.main:app)."""

from fastapi import FastAPI

from app.application.exceptions import InvalidDeviceCredentialsError
from app.interface.api.v1.heartbeats import router as heartbeats_router
from app.interface.error_handlers import invalid_device_credentials_handler

app = FastAPI(title="Equipment Monitor API")
app.include_router(heartbeats_router, prefix="/api/v1", tags=["heartbeats"])
app.add_exception_handler(InvalidDeviceCredentialsError, invalid_device_credentials_handler)