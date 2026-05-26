"""create password reset otp table

Revision ID: 20260525_0005
Revises: 20260522_0004
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260525_0005"
down_revision: str | None = "20260522_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "password_reset_otps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("otp_hash", sa.String(length=128), nullable=False),
        sa.Column("reset_token_hash", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_password_reset_otps_email"), "password_reset_otps", ["email"], unique=False)
    op.create_index("ix_password_reset_otps_email_created", "password_reset_otps", ["email", "created_at"], unique=False)
    op.create_index(op.f("ix_password_reset_otps_reset_token_hash"), "password_reset_otps", ["reset_token_hash"], unique=False)
    op.create_index(op.f("ix_password_reset_otps_user_id"), "password_reset_otps", ["user_id"], unique=False)
    op.create_index("ix_password_reset_otps_user_active", "password_reset_otps", ["user_id", "is_used"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_password_reset_otps_user_active", table_name="password_reset_otps")
    op.drop_index(op.f("ix_password_reset_otps_user_id"), table_name="password_reset_otps")
    op.drop_index(op.f("ix_password_reset_otps_reset_token_hash"), table_name="password_reset_otps")
    op.drop_index("ix_password_reset_otps_email_created", table_name="password_reset_otps")
    op.drop_index(op.f("ix_password_reset_otps_email"), table_name="password_reset_otps")
    op.drop_table("password_reset_otps")
