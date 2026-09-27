"""Script de seed manual — cria um Device + DeviceCredential no banco de
desenvolvimento (DATABASE_URL) para testar a API manualmente (curl/Postman).

Uso:
    uv run python scripts/seed_device.py
    uv run python scripts/seed_device.py --asset-number NB-001

Imprime o key_id e o secret em texto puro UMA VEZ — depois disso, só o hash
fica salvo no banco (ninguém, nem o próprio backend, consegue recuperar o
secret depois. ADR-006).
"""

import argparse
import secrets
import uuid

from argon2 import PasswordHasher

from app.domain.device_credential import DeviceCredentialStatus
from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.session import SessionLocal


def seed_device(asset_number: str) -> None:
    device_id = uuid.uuid4()
    key_id = secrets.token_hex(8)
    secret = secrets.token_urlsafe(24)
    secret_hash = PasswordHasher().hash(secret)

    session = SessionLocal()
    try:
        session.add(DeviceModel(id=device_id, asset_number=asset_number))
        session.flush()
        session.add(
            DeviceCredentialModel(
                id=uuid.uuid4(),
                device_id=device_id,
                key_id=key_id,
                secret_hash=secret_hash,
                status=DeviceCredentialStatus.ACTIVE,
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    print("Device criado com sucesso.")
    print(f"  device_id:     {device_id}")
    print(f"  asset_number:  {asset_number}")
    print(f"  key_id:        {key_id}")
    print(f"  secret:        {secret}   <- ANOTE AGORA, nao e possivel recuperar depois")
    print()
    print("Header de autenticacao para usar no curl/Postman:")
    print(f"  Authorization: DeviceKey {key_id}:{secret}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria um Device + DeviceCredential para teste manual.")
    parser.add_argument("--asset-number", default=f"NB-SEED-{secrets.token_hex(3).upper()}")
    args = parser.parse_args()

    seed_device(args.asset_number)


if __name__ == "__main__":
    main()