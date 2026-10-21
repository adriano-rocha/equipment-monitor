"""Entidade de domínio: Device.

Representa um equipamento do inventário e também os dados espelhados
recebidos pelo heartbeat.

O status de comunicação é calculado pelo backend a partir de last_seen e
não faz parte da entidade como estado persistido.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Device:
    id: UUID
    asset_number: str
    device_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    hostname: str | None = None
    reported_ip: str | None = None
    battery_level: int | None = None
    last_seen: datetime | None = None
    deleted_at: datetime | None = None

    def register_heartbeat(
        self,
        *,
        received_at: datetime,
        hostname: str | None,
        reported_ip: str | None,
        battery_level: int | None,
    ) -> None:
        """Atualiza os campos espelhados a partir do heartbeat mais recente.

        None significa "não informado" e não deve apagar o valor
        anteriormente armazenado.
        """
        self.last_seen = received_at

        if hostname is not None:
            self.hostname = hostname

        if reported_ip is not None:
            self.reported_ip = reported_ip

        if battery_level is not None:
            self.battery_level = battery_level