"""Serviço de aplicação para operações de usuários."""

from uuid import UUID, uuid4

from app.application.exceptions import UserNotFoundError
from app.application.ports.user_repository import UserRepository
from app.domain.user import User


class UserService:
    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    def create(
        self,
        *,
        name: str,
        email: str,
    ) -> User:
        user = User(
            id=uuid4(),
            name=name,
            email=email,
        )

        self._user_repository.add(user)

        return user

    def get_by_id(self, user_id: UUID) -> User | None:
        return self._user_repository.get_by_id(user_id)

    def list_all(self) -> list[User]:
        return self._user_repository.list_all()

    def update(
        self,
        *,
        user_id: UUID,
        name: str,
        email: str,
    ) -> User:
        user = self._user_repository.get_by_id(user_id)

        if user is None:
            raise UserNotFoundError()

        updated_user = User(
            id=user.id,
            name=name,
            email=email,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

        self._user_repository.update(updated_user)

        return updated_user