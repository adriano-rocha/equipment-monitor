"""Adiciona location_point em event_devices para ponto fisico

Revision ID: 3b95c23e81a1
Revises: 2a84b12c7890
Create Date: 2026-10-22 10:00:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "3b95c23e81a1"
down_revision: Union[str, Sequence[str], None] = "2a84b12c7890"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_devices",
        sa.Column("location_point", sa.String(length=100), nullable=True),
    )
    op.create_index(
        "ix_event_devices_location_point",
        "event_devices",
        ["location_point"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_event_devices_location_point", table_name="event_devices")
    op.drop_column("event_devices", "location_point")