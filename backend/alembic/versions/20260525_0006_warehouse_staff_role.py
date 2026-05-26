"""add warehouse staff role and assignment

Revision ID: 20260525_0006
Revises: 20260525_0005
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260525_0006"
down_revision: str | None = "20260525_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'WAREHOUSE_STAFF'")
    op.add_column("users", sa.Column("assigned_warehouse", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "assigned_warehouse")
    # PostgreSQL enum values cannot be removed safely without recreating the type.
