"""Implementação SQLAlchemy do port EventDeviceRepository."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.application.ports.event_device_repository import EventDeviceRepository
from app.domain.event_device import EventDevice
from app.infrastructure.db.models.event_device_model import EventDeviceModel


class SqlAlchemyEventDeviceRepository(EventDeviceRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, event_device: EventDevice) -> None:
        model = EventDeviceModel(
            id=event_device.id,
            event_id=event_device.event_id,
            device_id=event_device.device_id,
            assigned_user_id=event_device.assigned_user_id,
            assigned_at=event_device.assigned_at,
            unassigned_at=event_device.unassigned_at,
            created_at=event_device.created_at,
            updated_at=event_device.updated_at,
        )
        self._session.add(model)

    def get_by_id(
        self,
        event_device_id: UUID,
    ) -> EventDevice | None:
        model = self._session.get(EventDeviceModel, event_device_id)

        if model is None:
            return None

        return self._to_domain(model)

    def get_active(
        self,
        *,
        event_id: UUID,
        device_id: UUID,
    ) -> EventDevice | None:
        model = (
            self._session.query(EventDeviceModel)
            .filter(
                EventDeviceModel.event_id == event_id,
                EventDeviceModel.device_id == device_id,
                EventDeviceModel.unassigned_at.is_(None),
            )
            .first()
        )

        if model is None:
            return None

        return self._to_domain(model)

    def list_by_event(
        self,
        event_id: UUID,
    ) -> list[EventDevice]:
        models = (
            self._session.query(EventDeviceModel)
            .filter(EventDeviceModel.event_id == event_id)
            .order_by(EventDeviceModel.assigned_at.asc())
            .all()
        )

        return [self._to_domain(model) for model in models]

    def list_by_device(
        self,
        device_id: UUID,
    ) -> list[EventDevice]:
        models = (
            self._session.query(EventDeviceModel)
            .filter(EventDeviceModel.device_id == device_id)
            .order_by(EventDeviceModel.assigned_at.asc())
            .all()
        )

        return [self._to_domain(model) for model in models]

    def update(self, event_device: EventDevice) -> None:
        model = self._session.get(EventDeviceModel, event_device.id)

        if model is None:
            raise ValueError(
                f"EventDevice {event_device.id} não encontrado para atualização."
            )

        model.assigned_user_id = event_device.assigned_user_id
        model.assigned_at = event_device.assigned_at
        model.unassigned_at = event_device.unassigned_at

    @staticmethod
    def _to_domain(model: EventDeviceModel) -> EventDevice:
        return EventDevice(
            id=model.id,
            event_id=model.event_id,
            device_id=model.device_id,
            assigned_user_id=model.assigned_user_id,
            assigned_at=model.assigned_at,
            unassigned_at=model.unassigned_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )