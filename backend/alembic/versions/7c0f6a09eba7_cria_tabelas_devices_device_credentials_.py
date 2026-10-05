"""cria tabelas de devices, device_credentials e heartbeats

Revision ID: 7c0f6a09eba7
Revises: None
Create Date: 2026-10-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "7c0f6a09eba7"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Devices
    # ------------------------------------------------------------------
    op.create_table(
        "devices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "asset_number",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "hostname",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "reported_ip",
            sa.String(length=45),
            nullable=True,
        ),
        sa.Column(
            "battery_level",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "last_seen",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_devices_asset_number",
        "devices",
        ["asset_number"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # Device Credentials
    # ------------------------------------------------------------------
    device_credential_status = sa.Enum(
        "ACTIVE",
        "REVOKED",
        name="device_credential_status",
    )
    device_credential_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "device_credentials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "device_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "key_id",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "secret_hash",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "status",
            device_credential_status,
            nullable=False,
            server_default=sa.text("'ACTIVE'"),
        ),
        sa.Column(
            "last_used_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["devices.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_device_credentials_device_id",
        "device_credentials",
        ["device_id"],
        unique=False,
    )

    op.create_index(
        "ix_device_credentials_key_id",
        "device_credentials",
        ["key_id"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # Heartbeats
    # ------------------------------------------------------------------
    op.create_table(
        "heartbeats",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "device_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "source_ip",
            sa.String(length=45),
            nullable=False,
        ),
        sa.Column(
            "hostname",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "reported_ip",
            sa.String(length=45),
            nullable=True,
        ),
        sa.Column(
            "battery_level",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "device_timestamp",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["devices.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_heartbeats_device_id",
        "heartbeats",
        ["device_id"],
        unique=False,
    )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Heartbeats
    # ------------------------------------------------------------------
    op.drop_index(
        "ix_heartbeats_device_id",
        table_name="heartbeats",
    )
    op.drop_table("heartbeats")

    # ------------------------------------------------------------------
    # Device Credentials
    # ------------------------------------------------------------------
    op.drop_index(
        "ix_device_credentials_key_id",
        table_name="device_credentials",
    )
    op.drop_index(
        "ix_device_credentials_device_id",
        table_name="device_credentials",
    )
    op.drop_table("device_credentials")

    device_credential_status = sa.Enum(
        "ACTIVE",
        "REVOKED",
        name="device_credential_status",
    )
    device_credential_status.drop(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # Devices
    # ------------------------------------------------------------------
    op.drop_index(
        "ix_devices_asset_number",
        table_name="devices",
    )
    op.drop_table("devices")