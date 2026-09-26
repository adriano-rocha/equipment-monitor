"""Port (interface) do repositório de Device — implementado em T07 com SQLAlchemy.

Definido em termos da entidade de domínio (Device), nunca do modelo
SQLAlchemy — isso é o que mantém o domínio livre de infraestrutura (Clean
Architecture).
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.device import Device


class DeviceRepository(ABC):
    @abstractmethod
    def get_by_id(self, device_id: UUID) -> Device | None:
        """Busca um Device pela PK técnica. Retorna None se não existir."""

    @abstractmethod
    def update(self, device: Device) -> None:
        """Persiste as alterações feitas em um Device já existente.

        Não faz commit — a transação é responsabilidade de quem orquestra o
        use case (RegisterHeartbeatUseCase), para garantir atomicidade com os
        outros writes (heartbeat, last_used_at).
        """