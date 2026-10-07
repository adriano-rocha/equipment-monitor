import secrets
import string
import uuid

from argon2 import PasswordHasher

from app.infrastructure.db.models.device_credential_model import (
    DeviceCredentialModel,
)
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.session import SessionLocal
from app.domain.device_credential import DeviceCredentialStatus


def generate_secret(length: int = 32) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


db = SessionLocal()
hasher = PasswordHasher()

asset_number = "ANDROID-TESTE-001"
key_id = "android-teste-001"
secret = generate_secret()

try:
    existing_device = (
        db.query(DeviceModel)
        .filter(DeviceModel.asset_number == asset_number)
        .first()
    )

    if existing_device:
        raise RuntimeError(
            f"Já existe um device com asset_number={asset_number}"
        )

    existing_credential = (
        db.query(DeviceCredentialModel)
        .filter(DeviceCredentialModel.key_id == key_id)
        .first()
    )

    if existing_credential:
        raise RuntimeError(
            f"Já existe uma credential com key_id={key_id}"
        )

    device_id = uuid.uuid4()

    device = DeviceModel(
        id=device_id,
        asset_number=asset_number,
        device_type="SMARTPHONE",
        manufacturer="Samsung",
    )

    db.add(device)
    db.flush()

    credential = DeviceCredentialModel(
        id=uuid.uuid4(),
        device_id=device_id,
        key_id=key_id,
        secret_hash=hasher.hash(secret),
        status=DeviceCredentialStatus.ACTIVE,
    )

    db.add(credential)
    db.commit()

    print()
    print("=== ANDROID DEVICE PROVISIONADO ===")
    print(f"Device ID : {device_id}")
    print(f"Asset     : {asset_number}")
    print(f"Key ID    : {key_id}")
    print(f"Secret    : {secret}")
    print()
    print("GUARDE O SECRET. O BANCO ARMAZENA SOMENTE O HASH.")
    print()

except Exception:
    db.rollback()
    raise

finally:
    db.close()