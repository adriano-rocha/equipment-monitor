"""Expande o limite do tipo de dispositivo para 50 caracteres."""

from alembic import op
import sqlalchemy as sa


revision = "a76d901f4c2b"
down_revision = "c83f20ab55d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "devices",
        "device_type",
        existing_type=sa.String(length=30),
        type_=sa.String(length=50),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "devices",
        "device_type",
        existing_type=sa.String(length=50),
        type_=sa.String(length=30),
        existing_nullable=True,
    )
