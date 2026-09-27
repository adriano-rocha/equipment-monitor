"""RegisterHeartbeatUseCase — orquestra o fluxo da SPEC-001.

🔑 palavra-chave: execute() NÃO commita. Ele só chama update()/add() nos
repositórios (mudanças ficam "staged" na sessão). Quem decide quando commitar
é a camada de interface (T10) — isso é o que garante que os 3 writes (device,
credential, heartbeat) fiquem na mesma transação, e mantém este Use Case sem
nenhuma dependência de infraestrutura (nem sabe que existe uma Session).
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.application.ports.device_repository import DeviceRepository
from app.application.ports.heartbeat_repository import HeartbeatRepository
from app.domain.device import Device
from app.domain.device_credential import DeviceCredential
from app.domain.heartbeat import Heartbeat


@dataclass
class RegisterHeartbeatCommand:
    """Dados já autenticados (T08) e validados (T10 — schema Pydantic) que o
    Use Case precisa. Quem monta isso é a camada de interface."""

    device: Device
    credential: DeviceCredential
    received_at: datetime
    source_ip: str
    hostname: str | None = None
    reported_ip: str | None = None
    battery_level: int | None = None
    metadata: dict | None = None
    device_timestamp: datetime | None = None


class RegisterHeartbeatUseCase:
    def __init__(
        self,
        device_repository: DeviceRepository,
        credential_repository: DeviceCredentialRepository,
        heartbeat_repository: HeartbeatRepository,
    ) -> None:
        self._device_repository = device_repository
        self._credential_repository = credential_repository
        self._heartbeat_repository = heartbeat_repository

    def execute(self, command: RegisterHeartbeatCommand) -> Heartbeat:
        command.device.register_heartbeat(
            received_at=command.received_at,
            hostname=command.hostname,
            reported_ip=command.reported_ip,
            battery_level=command.battery_level,
        )
        command.credential.last_used_at = command.received_at

        heartbeat = Heartbeat(
            id=uuid4(),
            device_id=command.device.id,
            received_at=command.received_at,
            source_ip=command.source_ip,
            hostname=command.hostname,
            reported_ip=command.reported_ip,
            battery_level=command.battery_level,
            metadata=command.metadata,
            device_timestamp=command.device_timestamp,
        )

        self._device_repository.update(command.device)
        self._credential_repository.update(command.credential)
        self._heartbeat_repository.add(heartbeat)

        return heartbeat