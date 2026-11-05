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
from argon2 import PasswordHasher

# Hash descartável, calculado uma vez na importação do módulo.
# Serve só para igualar o tempo de resposta quando o usuário não existe.
_DUMMY_HASH = PasswordHasher().hash("dummy-password")

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, session: Session = Depends(get_db_session)) -> LoginResponse:
    user = (
        session.query(UserModel)
        .filter(UserModel.email == str(payload.email))
        .first()
    )

    auth_service = UserAuthService()

    hash_to_check = user.password_hash if user and user.password_hash else _DUMMY_HASH
    password_ok = auth_service.verify_password(hash_to_check, payload.password)

    if user is None or user.password_hash is None or not password_ok:
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

