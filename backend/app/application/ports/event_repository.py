"""Port (interface) do repositório de Event.

Definido em termos da entidade de domínio Event, nunca do modelo SQLAlchemy.
A implementação concreta fica na camada de infraestrutura.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from app.domain.event import Event


class EventRepository(ABC):
    @abstractmethod
    def add(self, event: Event) -> None:
        """Persiste um novo Event.

        Não faz commit. A transação é responsabilidade da camada que
        orquestra o caso de uso.
        """

    @abstractmethod
    def get_by_id(self, event_id: UUID) -> Event | None:
        """Busca um Event pela PK técnica. Retorna None se não existir."""

    @abstractmethod
    def list_all(self) -> list[Event]:
        """Lista todos os Events."""

    @abstractmethod
    def update(self, event: Event) -> None:
        """Persiste alterações em um Event existente.

        Não faz commit.
        """

    @abstractmethod
    def list_by_period(
        self,
        *,
        starts_at: datetime | None = None,
        ends_at: datetime | None = None,
        is_active: bool | None = None,
    ) -> list[Event]:
        """Lista Events aplicando filtros opcionais."""