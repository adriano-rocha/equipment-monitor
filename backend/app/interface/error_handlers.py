"""Handlers de exceção — convertem exceções da aplicação em respostas HTTP."""

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.application.exceptions import (
    DeviceNotFoundError,
    EventDeviceAlreadyActiveError,
    EventDeviceNotFoundError,
    EventNotFoundError,
    InvalidDeviceCredentialsError,
    UserNotFoundError,
)


async def invalid_device_credentials_handler(
    request: Request,
    exc: InvalidDeviceCredentialsError,
) -> JSONResponse:
    """401 genérico para credenciais de dispositivo inválidas.

    Nunca revela se o key_id existe ou se o secret está incorreto.
    """
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Credenciais de dispositivo inválidas."},
    )


async def event_not_found_handler(
    request: Request,
    exc: EventNotFoundError,
) -> JSONResponse:
    """404 quando o evento solicitado não existe."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Evento não encontrado."},
    )


async def device_not_found_handler(
    request: Request,
    exc: DeviceNotFoundError,
) -> JSONResponse:
    """404 quando o equipamento solicitado não existe."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Equipamento não encontrado."},
    )


async def user_not_found_handler(
    request: Request,
    exc: UserNotFoundError,
) -> JSONResponse:
    """404 quando o usuário solicitado não existe."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Usuário não encontrado."},
    )


async def event_device_not_found_handler(
    request: Request,
    exc: EventDeviceNotFoundError,
) -> JSONResponse:
    """404 quando a associação evento/equipamento não existe."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Associação entre evento e equipamento não encontrada."},
    )


async def event_device_already_active_handler(
    request: Request,
    exc: EventDeviceAlreadyActiveError,
) -> JSONResponse:
    """409 quando o equipamento já está associado ao evento."""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Equipamento já está associado a este evento."},
    )