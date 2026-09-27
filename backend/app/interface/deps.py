"""Dependências do FastAPI — ciclo de vida da Session e autenticação.

🔑 palavra-chave: get_db_session controla commit/rollback UMA vez por
request. Como get_current_device também depende dela, o FastAPI resolve a
dependência uma única vez (cacheada por request) e compartilha a MESMA
Session entre autenticação e rota — é isso que garante a transação única
(device + credential + heartbeat) exigida pela SPEC-001.
"""

from collections.abc import Generator

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.infrastructure.auth.device_auth_service import AuthenticatedDevice, DeviceAuthService
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import SqlAlchemyDeviceRepository
from app.infrastructure.db.session import SessionLocal


def get_db_session() -> Generator[Session, None, None]:
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
    auth_service = DeviceAuthService(
        credential_repository=SqlAlchemyDeviceCredentialRepository(session),
        device_repository=SqlAlchemyDeviceRepository(session),
    )
    return auth_service.authenticate(authorization)