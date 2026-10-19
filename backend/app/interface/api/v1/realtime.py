"""Endpoint WebSocket autenticado para o Dashboard."""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.infrastructure.auth.user_auth_service import (
    InvalidUserCredentialsError,
    UserAuthService,
)
from app.infrastructure.db.models.user_model import UserModel
from app.infrastructure.db.session import SessionLocal
from app.interface.realtime.websocket_manager import websocket_manager

router = APIRouter()
logger = logging.getLogger(__name__)

AUTH_TIMEOUT_SECONDS = 5


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Autentica o usuário antes de registrar a conexão WebSocket."""

    await websocket.accept()
    registered = False

    try:
        # Aguarda o JWT enviado pelo Dashboard.
        try:
            message = await asyncio.wait_for(
                websocket.receive_json(),
                timeout=AUTH_TIMEOUT_SECONDS,
            )
        except (asyncio.TimeoutError, ValueError):
            await websocket.close(
                code=4401,
                reason="Autenticação necessária.",
            )
            return

        if (
            not isinstance(message, dict)
            or message.get("type") != "authenticate"
            or not isinstance(message.get("token"), str)
            or not message["token"].strip()
        ):
            await websocket.close(
                code=4401,
                reason="Credenciais inválidas.",
            )
            return

        # Valida a assinatura, a expiração e o identificador do JWT.
        try:
            user_id = UserAuthService().decode_access_token(message["token"])
        except InvalidUserCredentialsError:
            await websocket.close(
                code=4401,
                reason="Token inválido ou expirado.",
            )
            return

        # Confirma que o usuário ainda existe no banco.
        session = SessionLocal()
        try:
            user = (
                session.query(UserModel)
                .filter(UserModel.id == user_id)
                .first()
            )
        finally:
            session.close()

        if user is None:
            await websocket.close(
                code=4401,
                reason="Usuário não encontrado.",
            )
            return

        # Somente conexões autenticadas recebem atualizações.
        websocket_manager.register(websocket)
        registered = True

        await websocket.send_json({"event": "authenticated"})

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        pass

    except Exception:
        logger.exception("Erro durante a conexão WebSocket.")

        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.close(
                    code=1011,
                    reason="Erro interno.",
                )
            except Exception:
                pass

    finally:
        if registered:
            websocket_manager.disconnect(websocket)