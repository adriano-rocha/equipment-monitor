"""Port (interface) do repositório de EventDevice.

Define as operações de persistência da associação histórica entre
eventos, equipamentos e responsáveis.

A interface trabalha exclusivamente com a entidade de domínio
EventDevice, mantendo a camada de aplicação independente do SQLAlchemy.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.event_device import EventDevice


class EventDeviceRepository(ABC):
    @abstractmethod
    def add(self, event_device: EventDevice) -> None:
        """Persiste uma nova associação.

        Não faz commit. A transação é responsabilidade da camada
        que orquestra o caso de uso.
        """

    @abstractmethod
    def get_by_id(self, event_device_id: UUID) -> EventDevice | None:
        """Busca uma associação pela PK técnica."""

    @abstractmethod
    def get_active(
        self,
        *,
        event_id: UUID,
        device_id: UUID,
    ) -> EventDevice | None:
        """Busca a associação ativa de um equipamento em um evento."""

    @abstractmethod
    def list_by_event(self, event_id: UUID) -> list[EventDevice]:
        """Lista as associações de um evento."""

    @abstractmethod
    def list_by_device(self, device_id: UUID) -> list[EventDevice]:
        """Lista o histórico de eventos de um equipamento."""

    @abstractmethod
    def update(self, event_device: EventDevice) -> None:
        """Persiste alterações em uma associação existente.

        Não faz commit.
        """