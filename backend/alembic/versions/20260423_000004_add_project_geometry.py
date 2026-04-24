"""add project geometry

Revision ID: 20260423_000004
Revises: 20260423_000003
Create Date: 2026-04-23 00:00:04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260423_000004"
down_revision: Union[str, None] = "20260423_000003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    project_columns = _column_names("projects")
    if "cell_active_area_m2" not in project_columns:
        op.add_column(
            "projects",
            sa.Column("cell_active_area_m2", sa.Float(), nullable=False, server_default="0.01"),
        )
    if "cell_thickness_mm" not in project_columns:
        op.add_column(
            "projects",
            sa.Column("cell_thickness_mm", sa.Float(), nullable=False, server_default="8.0"),
        )


def downgrade() -> None:
    project_columns = _column_names("projects")
    if "cell_thickness_mm" in project_columns:
        op.drop_column("projects", "cell_thickness_mm")
    if "cell_active_area_m2" in project_columns:
        op.drop_column("projects", "cell_active_area_m2")
