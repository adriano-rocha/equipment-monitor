"""Entidade de domínio: Device.

Nesta fase (SPEC-001 — Device Heartbeat), Device só carrega os campos que o
fluxo de heartbeat lê e atualiza. communication_status (calculado, ADR-007) e
operational_state (administrativo) não entram aqui ainda — expandir quando a
SPEC-002 (comunicação) ou a fase de eventos/responsáveis exigir.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Device:
    id: UUID
    asset_number: str
    hostname: str | None = None
    reported_ip: str | None = None
    battery_level: int | None = None
    last_seen: datetime | None = None

    def register_heartbeat(
        self,
        *,
        received_at: datetime,
        hostname: str | None,
        reported_ip: str | None,
        battery_level: int | None,
    ) -> None:
        """Atualiza os campos "espelhados" a partir do heartbeat mais recente.

        🔑 palavra-chave: campo só é sobrescrito se o agente MANDOU aquele
        campo no heartbeat — None aqui significa "não informado", nunca
        "apagar o valor anterior".
        """
        self.last_seen = received_at
        if hostname is not None:
            self.hostname = hostname
        if reported_ip is not None:
            self.reported_ip = reported_ip
        if battery_level is not None:
            self.battery_level = battery_level