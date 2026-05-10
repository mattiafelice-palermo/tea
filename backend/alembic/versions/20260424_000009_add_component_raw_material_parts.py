"""add component raw material parts

Revision ID: 20260424_000009
Revises: 20260424_000008
Create Date: 2026-04-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260424_000009"
down_revision: str | None = "20260424_000008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("component_raw_materials") as batch_op:
        batch_op.add_column(sa.Column("mass_part", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("component_raw_materials") as batch_op:
        batch_op.drop_column("mass_part")
