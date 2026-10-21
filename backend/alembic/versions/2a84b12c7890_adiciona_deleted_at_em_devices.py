"""Adiciona deleted_at em devices para soft delete

Revision ID: 2a84b12c7890
Revises: 0be30206e712
Create Date: 2026-10-21 19:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2a84b12c7890"
down_revision: Union[str, Sequence[str], None] = "0be30206e712"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_devices_deleted_at",
        "devices",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_devices_deleted_at", table_name="devices")
    op.drop_column("devices", "deleted_at")