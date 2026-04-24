"""add cost per kwh cycle

Revision ID: 20260423_000006
Revises: 20260423_000005
Create Date: 2026-04-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260423_000006"
down_revision: str | None = "20260423_000005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("results") as batch_op:
        batch_op.add_column(
            sa.Column("cost_per_kwh_cycle", sa.Float(), nullable=False, server_default="0")
        )


def downgrade() -> None:
    with op.batch_alter_table("results") as batch_op:
        batch_op.drop_column("cost_per_kwh_cycle")
