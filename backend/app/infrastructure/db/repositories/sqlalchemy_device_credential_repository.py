"""Implementação SQLAlchemy do port DeviceCredentialRepository."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.domain.device_credential import DeviceCredential
from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel


class SqlAlchemyDeviceCredentialRepository(DeviceCredentialRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_key_id(self, key_id: str) -> DeviceCredential | None:
        stmt = select(DeviceCredentialModel).where(DeviceCredentialModel.key_id == key_id)
        model = self._session.scalars(stmt).one_or_none()
        if model is None:
            return None
        return self._to_domain(model)

    def update(self, credential: DeviceCredential) -> None:
        model = self._session.get(DeviceCredentialModel, credential.id)
        if model is None:
            raise ValueError(f"DeviceCredential {credential.id} não encontrada para atualização.")
        model.last_used_at = credential.last_used_at
        model.status = credential.status

    @staticmethod
    def _to_domain(model: DeviceCredentialModel) -> DeviceCredential:
        return DeviceCredential(
            id=model.id,
            device_id=model.device_id,
            key_id=model.key_id,
            secret_hash=model.secret_hash,
            status=model.status,
            last_used_at=model.last_used_at,
        )