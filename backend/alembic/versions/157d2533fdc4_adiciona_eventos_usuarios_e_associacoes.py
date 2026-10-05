"""adiciona eventos usuarios e associacoes

Revision ID: 157d2533fdc4
Revises: 7c0f6a09eba7
Create Date: 2026-10-01 17:34:35.672923
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "157d2533fdc4"
down_revision: Union[str, Sequence[str], None] = "7c0f6a09eba7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Devices — campos operacionais do inventário
    # ------------------------------------------------------------------
    op.add_column(
        "devices",
        sa.Column("device_type", sa.String(length=30), nullable=True),
    )

    op.add_column(
        "devices",
        sa.Column("manufacturer", sa.String(length=100), nullable=True),
    )

    op.add_column(
        "devices",
        sa.Column("model", sa.String(length=150), nullable=True),
    )

    op.add_column(
        "devices",
        sa.Column("serial_number", sa.String(length=150), nullable=True),
    )

    op.create_index(
        "ix_devices_serial_number",
        "devices",
        ["serial_number"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_users_email",
        "users",
        ["email"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------
    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column(
            "starts_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "ends_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_events_starts_at",
        "events",
        ["starts_at"],
        unique=False,
    )

    op.create_index(
        "ix_events_ends_at",
        "events",
        ["ends_at"],
        unique=False,
    )

    op.create_index(
        "ix_events_is_active",
        "events",
        ["is_active"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # Event Devices
    # ------------------------------------------------------------------
    op.create_table(
        "event_devices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "unassigned_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["devices.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_event_devices_event_id",
        "event_devices",
        ["event_id"],
        unique=False,
    )

    op.create_index(
        "ix_event_devices_device_id",
        "event_devices",
        ["device_id"],
        unique=False,
    )

    op.create_index(
        "ix_event_devices_assigned_user_id",
        "event_devices",
        ["assigned_user_id"],
        unique=False,
    )

    op.create_index(
        "ix_event_devices_assigned_at",
        "event_devices",
        ["assigned_at"],
        unique=False,
    )

    # Apenas uma associação ATIVA para o mesmo evento + equipamento.
    # Associações encerradas permanecem como histórico.
    op.create_index(
        "uq_event_devices_active_event_device",
        "event_devices",
        ["event_id", "device_id"],
        unique=True,
        postgresql_where=sa.text("unassigned_at IS NULL"),
    )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Event Devices
    # ------------------------------------------------------------------
    op.drop_index(
        "uq_event_devices_active_event_device",
        table_name="event_devices",
    )

    op.drop_index(
        "ix_event_devices_assigned_at",
        table_name="event_devices",
    )

    op.drop_index(
        "ix_event_devices_assigned_user_id",
        table_name="event_devices",
    )

    op.drop_index(
        "ix_event_devices_device_id",
        table_name="event_devices",
    )

    op.drop_index(
        "ix_event_devices_event_id",
        table_name="event_devices",
    )

    op.drop_table("event_devices")

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------
    op.drop_index(
        "ix_events_is_active",
        table_name="events",
    )

    op.drop_index(
        "ix_events_ends_at",
        table_name="events",
    )

    op.drop_index(
        "ix_events_starts_at",
        table_name="events",
    )

    op.drop_table("events")

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------
    op.drop_index(
        "ix_users_email",
        table_name="users",
    )

    op.drop_table("users")

    # ------------------------------------------------------------------
    # Devices
    # ------------------------------------------------------------------
    op.drop_index(
        "ix_devices_serial_number",
        table_name="devices",
    )

    op.drop_column("devices", "serial_number")
    op.drop_column("devices", "model")
    op.drop_column("devices", "manufacturer")
    op.drop_column("devices", "device_type")