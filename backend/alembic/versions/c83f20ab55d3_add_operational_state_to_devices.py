"""add_operational_state_to_devices

Revision ID: c83f20ab55d3
Revises: b72e19fa44c2
Create Date: 2026-11-13 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c83f20ab55d3'
down_revision: Union[str, Sequence[str], None] = 'b72e19fa44c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'devices',
        sa.Column(
            'operational_state',
            sa.String(length=30),
            server_default='ATIVO',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('devices', 'operational_state')