"""add_geofence_and_coords_to_events

Revision ID: a59a86daaa47
Revises: 3b95c23e81a1
Create Date: 2026-11-03 14:53:40.160844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a59a86daaa47'
down_revision: Union[str, Sequence[str], None] = '3b95c23e81a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('events', sa.Column('geofence_radius', sa.Float(), server_default='250.0', nullable=True))
    op.add_column('events', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('events', sa.Column('longitude', sa.Float(), nullable=True))

def downgrade() -> None:
    op.drop_column('events', 'longitude')
    op.drop_column('events', 'latitude')
    op.drop_column('events', 'geofence_radius')