"""add stock transfer items and approval metadata

Revision ID: 20260525_0014
Revises: 20260525_0013
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260525_0014"
down_revision: str | None = "20260525_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stock_transfers", sa.Column("rejected_by", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("stock_transfers", sa.Column("admin_notes", sa.Text(), nullable=True))
    op.add_column("stock_transfers", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("stock_transfers", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("stock_transfers", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_stock_transfers_rejected_by_users",
        "stock_transfers",
        "users",
        ["rejected_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "stock_transfer_items",
        sa.Column("stock_transfer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("approved_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["stock_transfer_id"], ["stock_transfers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stock_transfer_items_stock_transfer_id"), "stock_transfer_items", ["stock_transfer_id"], unique=False)
    op.create_index(op.f("ix_stock_transfer_items_product_id"), "stock_transfer_items", ["product_id"], unique=False)

    op.execute(
        """
        INSERT INTO stock_transfer_items (
            id,
            stock_transfer_id,
            product_id,
            quantity,
            approved_quantity,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            id,
            product_id,
            quantity,
            CASE WHEN status IN ('approved', 'completed') THEN quantity ELSE 0 END,
            created_at,
            updated_at
        FROM stock_transfers
        WHERE product_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_stock_transfer_items_product_id"), table_name="stock_transfer_items")
    op.drop_index(op.f("ix_stock_transfer_items_stock_transfer_id"), table_name="stock_transfer_items")
    op.drop_table("stock_transfer_items")
    op.drop_constraint("fk_stock_transfers_rejected_by_users", "stock_transfers", type_="foreignkey")
    op.drop_column("stock_transfers", "completed_at")
    op.drop_column("stock_transfers", "rejected_at")
    op.drop_column("stock_transfers", "approved_at")
    op.drop_column("stock_transfers", "admin_notes")
    op.drop_column("stock_transfers", "rejected_by")
