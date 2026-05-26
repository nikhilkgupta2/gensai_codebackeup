"""add user management lookup indexes

Revision ID: 20260522_0003
Revises: 20260521_0002
Create Date: 2026-05-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260522_0003"
down_revision: str | None = "20260521_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_users_tenant_id_email", "users", ["tenant_id", "email"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_tenant_id_email", table_name="users")
