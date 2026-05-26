"""create tenants and users

Revision ID: 20260521_0001
Revises:
Create Date: 2026-05-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260521_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    tenant_status = postgresql.ENUM(
        "ACTIVE",
        "SUSPENDED",
        name="tenant_status",
        create_type=False,
    )
    user_role = postgresql.ENUM(
        "SUPER_ADMIN",
        "RETAILER_ADMIN",
        "INVENTORY_MANAGER",
        name="user_role",
        create_type=False,
    )
    tenant_status.create(op.get_bind(), checkfirst=True)
    user_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_name", sa.String(length=160), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("status", tenant_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tenants_contact_email"), "tenants", ["contact_email"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_tenant_id"), "users", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_tenant_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_tenants_contact_email"), table_name="tenants")
    op.drop_table("tenants")
    postgresql.ENUM(name="user_role").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="tenant_status").drop(op.get_bind(), checkfirst=True)
