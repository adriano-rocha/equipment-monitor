"""Implementação SQLAlchemy do port UserRepository."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.application.ports.user_repository import UserRepository
from app.domain.user import User
from app.infrastructure.db.models.user_model import UserModel


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, user: User) -> None:
        model = UserModel(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        self._session.add(model)

    def get_by_id(self, user_id: UUID) -> User | None:
        model = self._session.get(UserModel, user_id)

        if model is None:
            return None

        return self._to_domain(model)

    def list_all(self) -> list[User]:
        models = self._session.query(UserModel).all()
        return [self._to_domain(model) for model in models]

    def update(self, user: User) -> None:
        model = self._session.get(UserModel, user.id)

        if model is None:
            raise ValueError(
                f"User {user.id} não encontrado para atualização."
            )

        model.name = user.name
        model.email = user.email

    @staticmethod
    def _to_domain(model: UserModel) -> User:
        return User(
            id=model.id,
            name=model.name,
            email=model.email,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )