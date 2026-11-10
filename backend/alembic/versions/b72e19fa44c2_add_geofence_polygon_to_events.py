"""add_geofence_polygon_to_events

Revision ID: b72e19fa44c2
Revises: a59a86daaa47
Create Date: 2026-11-10 18:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b72e19fa44c2'
down_revision: Union[str, Sequence[str], None] = 'a59a86daaa47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'events',
        sa.Column('geofence_polygon', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('events', 'geofence_polygon')