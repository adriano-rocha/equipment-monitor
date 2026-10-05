"""Rotas de usuários da Fase 06."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.application.exceptions import UserNotFoundError
from app.application.services.user_service import UserService
from app.infrastructure.db.repositories.sqlalchemy_user_repository import (
    SqlAlchemyUserRepository,
)
from app.interface.api.v1.schemas.user_schema import (
    UserCreate,
    UserResponse,
)
from app.interface.deps import get_db_session

router = APIRouter()


def _get_user_service(session: Session) -> UserService:
    return UserService(
        user_repository=SqlAlchemyUserRepository(session),
    )


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    session: Session = Depends(get_db_session),
) -> UserResponse:
    service = _get_user_service(session)

    user = service.create(
        name=payload.name,
        email=payload.email,
    )

    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    session: Session = Depends(get_db_session),
) -> list[UserResponse]:
    service = _get_user_service(session)

    users = service.list_all()

    return [
        UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        for user in users
    ]


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    session: Session = Depends(get_db_session),
) -> UserResponse:
    service = _get_user_service(session)

    user = service.get_by_id(user_id)

    if user is None:
        raise UserNotFoundError()

    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )