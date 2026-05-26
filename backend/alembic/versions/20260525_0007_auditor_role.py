"""add auditor role

Revision ID: 20260525_0007
Revises: 20260525_0006
Create Date: 2026-05-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260525_0007"
down_revision: str | None = "20260525_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'AUDITOR'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely without recreating the type.
    pass
