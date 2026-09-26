"""Port (interface) do repositório de Heartbeat — implementado em T07."""

from abc import ABC, abstractmethod

from app.domain.heartbeat import Heartbeat


class HeartbeatRepository(ABC):
    @abstractmethod
    def add(self, heartbeat: Heartbeat) -> None:
        """Registra um novo heartbeat (histórico — nunca sobrescreve).

        Sem commit — ver DeviceRepository.update.
        """