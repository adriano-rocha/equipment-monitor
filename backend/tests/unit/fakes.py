"""Implementações fake dos ports — reutilizadas pelos testes unitários de
DeviceAuthService e RegisterHeartbeatUseCase. Sem banco, só dicts em memória.
"""

from app.application.ports.device_credential_repository import DeviceCredentialRepository
from app.application.ports.device_repository import DeviceRepository
from app.application.ports.heartbeat_repository import HeartbeatRepository
from app.domain import device
from app.domain.device import Device


class FakeDeviceRepository(DeviceRepository):
    def __init__(self):
        self._by_id = {}

    def add(self, device: Device) -> Device:
        self._by_id[device.id] = device
        return device

    def get_by_id(self, device_id):
        device = self._by_id.get(device_id)
        if device is None or getattr(device, "deleted_at", None) is not None:
            return None
        return device

    def list_all(self):
        return [
            d for d in self._by_id.values()
            if getattr(d, "deleted_at", None) is None
     ]

    def get_by_asset_number(self, asset_number: str) -> Device | None:
        for device in self._by_id.values():
            if getattr(device, "deleted_at", None) is None and device.asset_number == asset_number:
                return device
        return None

    def update(self, device):
        self._by_id[device.id] = device

    def list_all(self):
        return list(self._by_id.values())


class FakeDeviceCredentialRepository(DeviceCredentialRepository):
    def __init__(self):
        self._by_key_id = {}

    def add(self, credential):
        self._by_key_id[credential.key_id] = credential

    def get_by_key_id(self, key_id):
        return self._by_key_id.get(key_id)

    def update(self, credential):
        self._by_key_id[credential.key_id] = credential

    def get_by_device_id(self, device_id):
     for cred in self._by_key_id.values():
         if cred.device_id == device_id and cred.is_active():
             return cred
     return None    


class FakeHeartbeatRepository(HeartbeatRepository):
    def __init__(self):
        self.added: list = []

    def add(self, heartbeat):
        self.added.append(heartbeat)