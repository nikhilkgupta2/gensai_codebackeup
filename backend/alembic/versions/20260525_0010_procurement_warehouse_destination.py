"""add purchase order warehouse destination

Revision ID: 20260525_0010
Revises: 20260525_0009
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260525_0010"
down_revision: str | None = "20260525_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("purchase_orders", sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_purchase_orders_warehouse_id_warehouses",
        "purchase_orders",
        "warehouses",
        ["warehouse_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_purchase_orders_warehouse_id"), "purchase_orders", ["warehouse_id"], unique=False)

    op.execute(
        """
        UPDATE purchase_orders po
        SET warehouse_id = matched.warehouse_id
        FROM (
            SELECT DISTINCT ON (po_inner.id) po_inner.id AS po_id, w.id AS warehouse_id
            FROM purchase_orders po_inner
            JOIN purchase_order_items poi ON poi.purchase_order_id = po_inner.id
            JOIN products p ON p.id = poi.product_id
            JOIN warehouses w ON w.tenant_id = po_inner.tenant_id AND w.name = p.warehouse_location
            WHERE p.warehouse_location IS NOT NULL AND trim(p.warehouse_location) <> ''
            ORDER BY po_inner.id, poi.created_at ASC
        ) AS matched
        WHERE po.id = matched.po_id
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_purchase_orders_warehouse_id"), table_name="purchase_orders")
    op.drop_constraint("fk_purchase_orders_warehouse_id_warehouses", "purchase_orders", type_="foreignkey")
    op.drop_column("purchase_orders", "warehouse_id")
