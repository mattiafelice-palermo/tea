"""add modules

Revision ID: 20260423_000003
Revises: 20260423_000002
Create Date: 2026-04-23 00:00:03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260423_000003"
down_revision: Union[str, None] = "20260423_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scenario_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cells_in_series", sa.Integer(), nullable=False),
        sa.Column("cells_in_parallel", sa.Integer(), nullable=False),
        sa.Column("module_current_a", sa.Float(), nullable=False),
        sa.Column("cell_active_area_m2", sa.Float(), nullable=False),
        sa.Column("cell_thickness_mm", sa.Float(), nullable=False),
        sa.Column("mass_overhead_fraction", sa.Float(), nullable=False),
        sa.Column("volume_overhead_fraction", sa.Float(), nullable=False),
        sa.Column("cost_overhead_fraction", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenarios.id"]),
    )
    op.create_index("ix_modules_id", "modules", ["id"])

    op.create_table(
        "module_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_id", sa.Integer(), nullable=False),
        sa.Column("module_voltage_v", sa.Float(), nullable=False),
        sa.Column("module_capacity_ah", sa.Float(), nullable=False),
        sa.Column("module_energy_wh", sa.Float(), nullable=False),
        sa.Column("module_power_w", sa.Float(), nullable=False),
        sa.Column("discharge_time_h", sa.Float(), nullable=False),
        sa.Column("cell_current_a", sa.Float(), nullable=False),
        sa.Column("cell_current_density_ma_per_cm2", sa.Float(), nullable=False),
        sa.Column("total_cell_count", sa.Integer(), nullable=False),
        sa.Column("module_mass_kg", sa.Float(), nullable=False),
        sa.Column("module_volume_l", sa.Float(), nullable=False),
        sa.Column("module_cost", sa.Float(), nullable=False),
        sa.Column("module_specific_energy_wh_per_kg", sa.Float(), nullable=False),
        sa.Column("module_volumetric_energy_wh_per_l", sa.Float(), nullable=False),
        sa.Column("module_lifetime_energy_wh", sa.Float(), nullable=False),
        sa.Column("module_cost_per_kwh", sa.Float(), nullable=False),
        sa.Column("module_cost_per_lifetime_kwh", sa.Float(), nullable=False),
        sa.Column("module_lcos", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"]),
        sa.UniqueConstraint("module_id"),
    )
    op.create_index("ix_module_results_id", "module_results", ["id"])


def downgrade() -> None:
    op.drop_index("ix_module_results_id", table_name="module_results")
    op.drop_table("module_results")
    op.drop_index("ix_modules_id", table_name="modules")
    op.drop_table("modules")
