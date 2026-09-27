"""Helpers de seed compartilhados entre os testes de integração e de API."""

import uuid

from argon2 import PasswordHasher

from app.domain.device_credential import DeviceCredentialStatus
from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel

_HASHER = PasswordHasher()


def seed_device_and_credential(
    db_session,
    key_id: str,
    asset_number: str = "NB-TESTE-001",
    secret: str | None = None,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Cria Device + DeviceCredential (simula provisionamento prévio do
    dispositivo — fora do escopo desta spec).

    Se `secret` for informado, gera um hash argon2 REAL (necessário pros
    testes de API, que autenticam de verdade via HTTP). Sem `secret`, usa um
    hash-placeholder (suficiente pros testes de integração que não passam
    pela verificação de senha).

    🔑 palavra-chave: precisa de um flush() entre os dois INSERTs — sem uma
    relationship() ORM declarada entre os modelos, o SQLAlchemy não garante
    que o INSERT de devices rode antes do de device_credentials no mesmo
    flush, e a FK pode falhar.
    """
    device_id = uuid.uuid4()
    db_session.add(DeviceModel(id=device_id, asset_number=asset_number))
    db_session.flush()

    secret_hash = _HASHER.hash(secret) if secret else "hash-fake"

    credential_id = uuid.uuid4()
    db_session.add(
        DeviceCredentialModel(
            id=credential_id,
            device_id=device_id,
            key_id=key_id,
            secret_hash=secret_hash,
            status=DeviceCredentialStatus.ACTIVE,
        )
    )
    db_session.commit()
    return device_id, credential_id