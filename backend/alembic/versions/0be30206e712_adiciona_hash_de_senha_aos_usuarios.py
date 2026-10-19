"""Adiciona hash de senha aos usuários."""

from alembic import op
import sqlalchemy as sa

# Identificadores da migração.
revision = "0be30206e712"
down_revision = "157d2533fdc4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")

