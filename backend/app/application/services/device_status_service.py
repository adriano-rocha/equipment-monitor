"""Serviço de cálculo do estado de comunicação do equipamento."""

from datetime import datetime, timezone

from app.infrastructure.config import Settings


ONLINE = "ONLINE"
SEM_COMUNICACAO = "SEM COMUNICAÇÃO"
OFFLINE = "OFFLINE"
SEM_REGISTRO = "SEM REGISTRO"


def calculate_communication_status(
    last_seen: datetime | None,
    settings: Settings,
) -> str:
    """Calcula o estado atual de comunicação de um device.

    Regras da Fase 05:
    - até HEARTBEAT_INTERVAL_SECONDS: ONLINE
    - acima do intervalo esperado até OFFLINE_THRESHOLD_SECONDS:
      SEM COMUNICAÇÃO
    - acima de OFFLINE_THRESHOLD_SECONDS: OFFLINE
    """

    if last_seen is None:
        return SEM_REGISTRO

    now = datetime.now(timezone.utc)

    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)

    elapsed_seconds = max(0.0, (now - last_seen).total_seconds())

    if elapsed_seconds <= settings.heartbeat_interval_seconds:
        return ONLINE

    if elapsed_seconds <= settings.offline_threshold_seconds:
        return SEM_COMUNICACAO

    return OFFLINE