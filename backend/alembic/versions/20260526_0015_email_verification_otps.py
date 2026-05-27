"""add email verification otps

Revision ID: 20260526_0015
Revises: 20260525_0014
Create Date: 2026-05-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260526_0015"
down_revision: str | None = "20260525_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "email_verification_otps",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("otp_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_verification_otps_user_id"), "email_verification_otps", ["user_id"], unique=False)
    op.create_index(op.f("ix_email_verification_otps_email"), "email_verification_otps", ["email"], unique=False)
    op.create_index(op.f("ix_email_verification_otps_is_used"), "email_verification_otps", ["is_used"], unique=False)
    op.create_index("ix_email_verification_otps_user_active", "email_verification_otps", ["user_id", "is_used"], unique=False)
    op.create_index("ix_email_verification_otps_email_created", "email_verification_otps", ["email", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_email_verification_otps_email_created", table_name="email_verification_otps")
    op.drop_index("ix_email_verification_otps_user_active", table_name="email_verification_otps")
    op.drop_index(op.f("ix_email_verification_otps_is_used"), table_name="email_verification_otps")
    op.drop_index(op.f("ix_email_verification_otps_email"), table_name="email_verification_otps")
    op.drop_index(op.f("ix_email_verification_otps_user_id"), table_name="email_verification_otps")
    op.drop_table("email_verification_otps")

    op.drop_column("users", "is_email_verified")

