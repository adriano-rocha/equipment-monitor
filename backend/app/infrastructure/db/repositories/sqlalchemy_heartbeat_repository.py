"""Implementação SQLAlchemy do port HeartbeatRepository."""

from sqlalchemy.orm import Session

from app.application.ports.heartbeat_repository import HeartbeatRepository
from app.domain.heartbeat import Heartbeat
from app.infrastructure.db.models.heartbeat_model import HeartbeatModel


class SqlAlchemyHeartbeatRepository(HeartbeatRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, heartbeat: Heartbeat) -> None:
        model = HeartbeatModel(
            id=heartbeat.id,
            device_id=heartbeat.device_id,
            received_at=heartbeat.received_at,
            source_ip=heartbeat.source_ip,
            hostname=heartbeat.hostname,
            reported_ip=heartbeat.reported_ip,
            battery_level=heartbeat.battery_level,
            metadata_=heartbeat.metadata,
            device_timestamp=heartbeat.device_timestamp,
        )
        self._session.add(model)