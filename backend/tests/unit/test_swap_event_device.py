"""Testes unitários para o caso de uso SwapEventDeviceUseCase."""

from datetime import datetime, timezone
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.use_cases.swap_event_device_use_case import (
    SwapEventDeviceInput,
    SwapEventDeviceUseCase,
)
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.models.event_device_model import EventDeviceModel
from app.infrastructure.db.models.event_model import EventModel


@pytest.fixture
def sqlite_session():
    """Cria banco SQLite em memória isolado para teste unitário do Swap."""
    engine = create_engine("sqlite:///:memory:")
    # Usa o metadata registrado pelos próprios modelos
    EventDeviceModel.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    yield session
    session.close()


def test_swap_device_success_transfers_point_atomically(sqlite_session: Session):
    event_id = uuid.uuid4()
    dev1_id = uuid.uuid4()
    dev2_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    # Cria associação do aparelho 1 no posto 'Portaria A'
    assoc1 = EventDeviceModel(
        id=uuid.uuid4(),
        event_id=event_id,
        device_id=dev1_id,
        location_point="Portaria A",
        assigned_user_id=None,
        assigned_at=now,
    )
    sqlite_session.add(assoc1)
    sqlite_session.commit()

    # Executa o Swap para o aparelho 2
    use_case = SwapEventDeviceUseCase(sqlite_session)
    result = use_case.execute(
        SwapEventDeviceInput(
            event_id=event_id,
            current_device_id=dev1_id,
            new_device_id=dev2_id,
        )
    )
    sqlite_session.commit()

    # Verifica que o aparelho 1 foi desvinculado
    sqlite_session.refresh(assoc1)
    assert assoc1.unassigned_at is not None

    # Verifica que o aparelho 2 assumiu exatamente o mesmo posto
    assert result.device_id == dev2_id
    assert result.location_point == "Portaria A"
    assert result.unassigned_at is None


def test_swap_device_fails_when_origin_not_active(sqlite_session: Session):
    event_id = uuid.uuid4()
    dev1_id = uuid.uuid4()
    dev2_id = uuid.uuid4()

    use_case = SwapEventDeviceUseCase(sqlite_session)
    with pytest.raises(ValueError, match="não está alocado ativamente"):
        use_case.execute(
            SwapEventDeviceInput(
                event_id=event_id,
                current_device_id=dev1_id,
                new_device_id=dev2_id,
            )
        )