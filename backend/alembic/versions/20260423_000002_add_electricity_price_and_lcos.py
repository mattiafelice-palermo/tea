"""add electricity price and lcos

Revision ID: 20260423_000002
Revises: 20260422_000001
Create Date: 2026-04-23 00:00:02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260423_000002"
down_revision: Union[str, None] = "20260422_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    scenario_columns = _column_names("scenarios")
    if "electricity_price_eur_per_kwh" not in scenario_columns:
        op.add_column(
            "scenarios",
            sa.Column("electricity_price_eur_per_kwh", sa.Float(), nullable=False, server_default="0.15"),
        )

    result_columns = _column_names("results")
    if "lcos" not in result_columns:
        op.add_column(
            "results",
            sa.Column("lcos", sa.Float(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    result_columns = _column_names("results")
    if "lcos" in result_columns:
        op.drop_column("results", "lcos")

    scenario_columns = _column_names("scenarios")
    if "electricity_price_eur_per_kwh" in scenario_columns:
        op.drop_column("scenarios", "electricity_price_eur_per_kwh")
