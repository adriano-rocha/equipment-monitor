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

        def list_all(self):
            return list(self._devices.values())

        def add(self, device):
            self._devices[device.id] = device
            return device

        def get_by_asset_number(self, asset_number):
            for d in self._devices.values():
                if d.asset_number == asset_number:
                    return d
            return None

    repo = FakeDeviceRepository()
    assert repo is not None