"""Port (interface) do repositório de User.

A interface trabalha exclusivamente com a entidade de domínio User,
mantendo a camada de aplicação independente do SQLAlchemy.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.user import User


class UserRepository(ABC):
    @abstractmethod
    def add(self, user: User) -> None:
        """Persiste um novo usuário.

        Não faz commit.
        """

    @abstractmethod
    def get_by_id(self, user_id: UUID) -> User | None:
        """Busca um usuário pela PK técnica."""

    @abstractmethod
    def list_all(self) -> list[User]:
        """Lista todos os usuários."""

    @abstractmethod
    def update(self, user: User) -> None:
        """Persiste alterações em um usuário existente.

        Não faz commit.
        """