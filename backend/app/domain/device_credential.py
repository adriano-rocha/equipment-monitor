"""Entidade de domínio: DeviceCredential (ADR-006).

Credencial de autenticação de um dispositivo — par key_id (público, indexado)
+ secret (armazenado só como hash). Não confundir com Device.id (PK técnica)
nem com Device.asset_number (patrimônio) — nenhum dos dois é usado como
credencial.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class DeviceCredentialStatus(str, Enum):
    """Só os dois estados que a SPEC-001 usa. Rotação/revogação completa via
    API fica fora de escopo desta spec — expandir quando a spec correspondente
    exigir outros estados."""

    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


@dataclass
class DeviceCredential:
    id: UUID
    device_id: UUID
    key_id: str
    secret_hash: str
    status: DeviceCredentialStatus
    last_used_at: datetime | None = None

    def is_active(self) -> bool:
        return self.status is DeviceCredentialStatus.ACTIVE