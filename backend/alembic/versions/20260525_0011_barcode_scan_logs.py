"""add barcode scan logs

Revision ID: 20260525_0011
Revises: 20260525_0010
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260525_0011"
down_revision: str | None = "20260525_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "product_scan_logs",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scanned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("code", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="manual"),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scanned_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_scan_logs_tenant_id"), "product_scan_logs", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_product_scan_logs_product_id"), "product_scan_logs", ["product_id"], unique=False)
    op.create_index(op.f("ix_product_scan_logs_scanned_by"), "product_scan_logs", ["scanned_by"], unique=False)
    op.create_index(
        "ix_product_scan_logs_tenant_created_at",
        "product_scan_logs",
        ["tenant_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_product_scan_logs_tenant_created_at", table_name="product_scan_logs")
    op.drop_index(op.f("ix_product_scan_logs_scanned_by"), table_name="product_scan_logs")
    op.drop_index(op.f("ix_product_scan_logs_product_id"), table_name="product_scan_logs")
    op.drop_index(op.f("ix_product_scan_logs_tenant_id"), table_name="product_scan_logs")
    op.drop_table("product_scan_logs")
