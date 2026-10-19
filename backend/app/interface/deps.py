"""Dependências do FastAPI para sessões e autenticação."""

from collections.abc import Generator

from fastapi import (
    Depends,
    Header,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from sqlalchemy.orm import Session

from app.infrastructure.auth.device_auth_service import (
    AuthenticatedDevice,
    DeviceAuthService,
)
from app.infrastructure.auth.user_auth_service import (
    InvalidUserCredentialsError,
    UserAuthService,
)
from app.infrastructure.db.models.user_model import UserModel
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)
from app.infrastructure.db.session import SessionLocal


# Não bloqueia automaticamente a requisição quando o token está ausente.
# Isso permite responder com 401 de maneira controlada.
bearer_scheme = HTTPBearer(auto_error=False)


def get_db_session() -> Generator[Session, None, None]:
    """Gerencia a sessão e a transação do banco por requisição."""
    session = SessionLocal()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_current_device(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_db_session),
) -> AuthenticatedDevice:
    """Autentica dispositivos por meio de DeviceKey."""
    auth_service = DeviceAuthService(
        credential_repository=SqlAlchemyDeviceCredentialRepository(session),
        device_repository=SqlAlchemyDeviceRepository(session),
    )

    return auth_service.authenticate(authorization)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    session: Session = Depends(get_db_session),
) -> UserModel:
    """Valida o JWT e retorna o usuário autenticado."""

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service = UserAuthService()

    try:
        user_id = auth_service.decode_access_token(
            credentials.credentials
        )
    except InvalidUserCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = session.query(UserModel).filter(
        UserModel.id == user_id
    ).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user