"""add study models

Revision ID: 20260424_000010
Revises: 20260424_000009
Create Date: 2026-04-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260424_000010"
down_revision: str | None = "20260424_000009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "study_models",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("input_variable", sa.String(length=100), nullable=False),
        sa.Column("output_metric", sa.String(length=100), nullable=False),
        sa.Column("correlation_type", sa.String(length=50), nullable=False),
        sa.Column("parameters_json", sa.Text(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_models_id"), "study_models", ["id"], unique=False)

    op.create_table(
        "study_model_points",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["model_id"], ["study_models.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_study_model_points_id"), "study_model_points", ["id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_study_model_points_id"), table_name="study_model_points")
    op.drop_table("study_model_points")
    op.drop_index(op.f("ix_study_models_id"), table_name="study_models")
    op.drop_table("study_models")
