"""Handlers de exceção — convertem exceções da camada de aplicação em
respostas HTTP apropriadas."""

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.application.exceptions import InvalidDeviceCredentialsError


async def invalid_device_credentials_handler(
    request: Request, exc: InvalidDeviceCredentialsError
) -> JSONResponse:
    """401 genérico — nunca revela se o key_id existe ou se o secret está
    incorreto (regra explícita do projeto)."""
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Credenciais de dispositivo inválidas."},
    )