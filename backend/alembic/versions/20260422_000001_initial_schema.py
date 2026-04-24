"""initial schema

Revision ID: 20260422_000001
Revises: 
Create Date: 2026-04-22 00:00:01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260422_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "components",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("density", sa.Float(), nullable=False),
        sa.Column("cost_per_kg", sa.Float(), nullable=False),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_components_id", "components", ["id"])

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_projects_id", "projects", ["id"])

    op.create_table(
        "project_components",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("component_id", sa.Integer(), nullable=False),
        sa.Column("mass", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["component_id"], ["components.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint("project_id", "component_id", name="uq_project_component"),
    )
    op.create_index("ix_project_components_id", "project_components", ["id"])

    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("avg_discharge_voltage", sa.Float(), nullable=False),
        sa.Column("avg_charge_voltage", sa.Float(), nullable=False),
        sa.Column("discharge_capacity", sa.Float(), nullable=False),
        sa.Column("cycle_life", sa.Integer(), nullable=False),
        sa.Column("end_of_life_fraction", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("ix_scenarios_id", "scenarios", ["id"])

    op.create_table(
        "results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scenario_id", sa.Integer(), nullable=False),
        sa.Column("total_mass", sa.Float(), nullable=False),
        sa.Column("total_cost", sa.Float(), nullable=False),
        sa.Column("energy_wh", sa.Float(), nullable=False),
        sa.Column("specific_energy", sa.Float(), nullable=False),
        sa.Column("round_trip_efficiency", sa.Float(), nullable=False),
        sa.Column("lifetime_energy", sa.Float(), nullable=False),
        sa.Column("cost_per_kwh", sa.Float(), nullable=False),
        sa.Column("cost_per_lifetime_kwh", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenarios.id"]),
        sa.UniqueConstraint("scenario_id"),
    )
    op.create_index("ix_results_id", "results", ["id"])


def downgrade() -> None:
    op.drop_index("ix_results_id", table_name="results")
    op.drop_table("results")
    op.drop_index("ix_scenarios_id", table_name="scenarios")
    op.drop_table("scenarios")
    op.drop_index("ix_project_components_id", table_name="project_components")
    op.drop_table("project_components")
    op.drop_index("ix_projects_id", table_name="projects")
    op.drop_table("projects")
    op.drop_index("ix_components_id", table_name="components")
    op.drop_table("components")
