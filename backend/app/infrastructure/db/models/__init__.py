"""Importa todos os modelos para registrá-los em Base.metadata.

Necessário para o Alembic autogenerate "enxergar" as tabelas — sem este
import, as classes de modelo nunca são carregadas e Base.metadata fica vazio.
"""

from app.infrastructure.db.models.device_credential_model import DeviceCredentialModel
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel

__all__ = ["DeviceModel", "DeviceCredentialModel", "HeartbeatModel"]
