"""Implementação SQLAlchemy do port DeviceRepository."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.application.ports.device_repository import DeviceRepository
from app.domain.device import Device
from app.infrastructure.db.models.device_model import DeviceModel


class SqlAlchemyDeviceRepository(DeviceRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, device_id: UUID) -> Device | None:
        model = self._session.get(DeviceModel, device_id)
        if model is None:
            return None
        return self._to_domain(model)

    def list_all(self) -> list[Device]:
        models = self._session.query(DeviceModel).all()
        return [self._to_domain(model) for model in models]

    def update(self, device: Device) -> None:
        """Reaplica os campos do Device no model já rastreado pela sessão.

        🔑 palavra-chave: session.get() com o MESMO id, na MESMA sessão, não
        gera uma segunda consulta — o SQLAlchemy resolve pela identity map
        (cache interno da sessão), reaproveitando o objeto já carregado
        (ex.: pelo DeviceAuthService). Isso satisfaz a regra de "não fazer
        lookup duplicado ao Device".
        """
        model = self._session.get(DeviceModel, device.id)
        if model is None:
            raise ValueError(f"Device {device.id} não encontrado para atualização.")
        model.hostname = device.hostname
        model.reported_ip = device.reported_ip
        model.battery_level = device.battery_level
        model.last_seen = device.last_seen

    @staticmethod
    def _to_domain(model: DeviceModel) -> Device:
        return Device(
            id=model.id,
            asset_number=model.asset_number,
            hostname=model.hostname,
            reported_ip=model.reported_ip,
            battery_level=model.battery_level,
            last_seen=model.last_seen,
        )