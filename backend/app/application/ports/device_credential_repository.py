"""Port (interface) do repositório de DeviceCredential — implementado em T07."""

from abc import ABC, abstractmethod

from app.domain.device_credential import DeviceCredential
from click import UUID


class DeviceCredentialRepository(ABC):
    @abstractmethod
    def get_by_key_id(self, key_id: str) -> DeviceCredential | None:
        """Busca a credencial pelo key_id público (índice único).

        Usado pelo DeviceAuthService (T08) — key_id nunca é asset_number nem
        id interno (ADR-006).
        """

    @abstractmethod
    def update(self, credential: DeviceCredential) -> None:
        """Persiste alterações (ex.: last_used_at). Sem commit — ver
        DeviceRepository.update."""

    @abstractmethod
    def add(self, credential: DeviceCredential) -> None:
        """Adiciona uma nova DeviceCredential vinculada a um dispositivo.
        
        Sem commit — gerenciado pelo escopo da transação.
        """    

    @abstractmethod
    def get_by_device_id(self, device_id: UUID) -> DeviceCredential | None: # type: ignore
        """Busca a credencial ativa vinculada ao ID do dispositivo."""    