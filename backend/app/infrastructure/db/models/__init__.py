"""Importa todos os modelos para registrá-los em Base.metadata.

Necessário para o Alembic autogenerate enxergar todas as tabelas.
"""

from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.event_device_model import EventDeviceModel
from app.infrastructure.db.models.event_model import EventModel
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel
from app.infrastructure.db.models.user_model import UserModel

__all__ = [
    "DeviceModel",
    "DeviceCredentialModel",
    "HeartbeatModel",
    "UserModel",
    "EventModel",
    "EventDeviceModel",
]