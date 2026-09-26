"""Base declarativa do SQLAlchemy — compartilhada por todos os modelos.

Os modelos concretos (DeviceModel, HeartbeatModel, DeviceCredentialModel — T05)
herdam desta Base. O Alembic usa Base.metadata para autogenerate.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass