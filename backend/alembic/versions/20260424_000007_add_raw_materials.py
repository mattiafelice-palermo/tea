"""add raw materials

Revision ID: 20260424_000007
Revises: 20260423_000006
Create Date: 2026-04-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260424_000007"
down_revision: str | None = "20260423_000006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "raw_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cost_per_kg", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_raw_materials_id"), "raw_materials", ["id"], unique=False)

    op.create_table(
        "component_raw_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("component_id", sa.Integer(), nullable=False),
        sa.Column("raw_material_id", sa.Integer(), nullable=False),
        sa.Column("mass_fraction", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["component_id"], ["components.id"]),
        sa.ForeignKeyConstraint(["raw_material_id"], ["raw_materials.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "component_id",
            "raw_material_id",
            name="uq_component_raw_material",
        ),
    )
    op.create_index(
        op.f("ix_component_raw_materials_id"),
        "component_raw_materials",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_component_raw_materials_id"), table_name="component_raw_materials")
    op.drop_table("component_raw_materials")
    op.drop_index(op.f("ix_raw_materials_id"), table_name="raw_materials")
    op.drop_table("raw_materials")
