"""Testes dos ports (contratos de repositório).

Provam que:
- Não é possível instanciar um port diretamente (é uma interface).
- Uma implementação completa funciona conforme o contrato esperado.
"""

from uuid import uuid4

import pytest

from app.application.ports.device_repository import DeviceRepository
from app.domain.device import Device


def test_device_repository_cannot_be_instantiated_directly():
    with pytest.raises(TypeError):
        DeviceRepository()


def test_fake_device_repository_satisfies_contract():
    class FakeDeviceRepository(DeviceRepository):
        def __init__(self):
            self._devices: dict = {}

        def get_by_id(self, device_id):
            return self._devices.get(device_id)

        def update(self, device):
            self._devices[device.id] = device

    repo = FakeDeviceRepository()
    device = Device(id=uuid4(), asset_number="NB-001")

    assert repo.get_by_id(device.id) is None
    repo.update(device)
    assert repo.get_by_id(device.id) is device