"""Endpoints de autenticação de usuários."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.infrastructure.auth.user_auth_service import (
    InvalidUserCredentialsError,
    UserAuthService,
)
from app.infrastructure.db.models.user_model import UserModel
from app.interface.api.v1.schemas.auth_schema import (
    LoginRequest,
    LoginResponse,
)
from app.interface.deps import get_db_session

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    session: Session = Depends(get_db_session),
) -> LoginResponse:
    user = (
        session.query(UserModel)
        .filter(UserModel.email == str(payload.email))
        .first()
    )

    auth_service = UserAuthService()

    # A resposta é igual para usuário inexistente, senha incorreta
    # ou conta sem senha configurada.
    if (
        user is None
        or user.password_hash is None
        or not auth_service.verify_password(
            user.password_hash,
            payload.password,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token = auth_service.create_access_token(user.id)
    except Exception:
        # Não expor detalhes internos de configuração ao cliente.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível iniciar a sessão.",
        )

    return LoginResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
    )

