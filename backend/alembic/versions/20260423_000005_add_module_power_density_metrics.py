"""add module power density metrics

Revision ID: 20260423_000005
Revises: 20260423_000004
Create Date: 2026-04-23 23:35:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260423_000005"
down_revision = "20260423_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("module_results")}

    if "module_specific_power_w_per_kg" not in columns:
        op.add_column(
            "module_results",
            sa.Column("module_specific_power_w_per_kg", sa.Float(), nullable=False, server_default="0"),
        )
    if "module_volumetric_power_w_per_l" not in columns:
        op.add_column(
            "module_results",
            sa.Column("module_volumetric_power_w_per_l", sa.Float(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("module_results")}

    if "module_volumetric_power_w_per_l" in columns:
        op.drop_column("module_results", "module_volumetric_power_w_per_l")
    if "module_specific_power_w_per_kg" in columns:
        op.drop_column("module_results", "module_specific_power_w_per_kg")
