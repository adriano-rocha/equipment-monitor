"""Gerenciador simples de conexões WebSocket do Dashboard."""

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        """Aceita e registra uma conexão WebSocket."""
        await websocket.accept()
        self.register(websocket)

    def register(self, websocket: WebSocket) -> None:
        """Registra uma conexão já aceita."""
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove uma conexão do gerenciador."""
        self._connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        """Envia uma mensagem a todas as conexões registradas."""
        disconnected: list[WebSocket] = []

        for websocket in self._connections.copy():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)

        for websocket in disconnected:
            self.disconnect(websocket)


websocket_manager = WebSocketManager()