"""add multi warehouse system

Revision ID: 20260525_0009
Revises: 20260525_0008
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260525_0009"
down_revision: str | None = "20260525_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.create_table(
        "warehouses",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("manager", sa.String(length=255), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "code", name="uq_warehouses_tenant_code"),
        sa.UniqueConstraint("tenant_id", "name", name="uq_warehouses_tenant_name"),
    )
    op.create_index(op.f("ix_warehouses_tenant_id"), "warehouses", ["tenant_id"])

    op.create_table(
        "warehouse_inventory",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("warehouse_id", "product_id", name="uq_warehouse_inventory_item"),
    )
    op.create_index(op.f("ix_warehouse_inventory_tenant_id"), "warehouse_inventory", ["tenant_id"])
    op.create_index(op.f("ix_warehouse_inventory_warehouse_id"), "warehouse_inventory", ["warehouse_id"])
    op.create_index(op.f("ix_warehouse_inventory_product_id"), "warehouse_inventory", ["product_id"])

    op.create_table(
        "stock_transfers",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_warehouse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("destination_warehouse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_warehouse_id"], ["warehouses.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["destination_warehouse_id"], ["warehouses.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stock_transfers_tenant_id"), "stock_transfers", ["tenant_id"])
    op.create_index(op.f("ix_stock_transfers_status"), "stock_transfers", ["status"])

    op.execute(
        """
        INSERT INTO warehouses (tenant_id, name, code, id, created_at, updated_at)
        SELECT DISTINCT tenant_id, warehouse_location,
               upper(regexp_replace(warehouse_location, '[^a-zA-Z0-9]+', '-', 'g')),
               gen_random_uuid(), now(), now()
        FROM products
        WHERE tenant_id IS NOT NULL AND warehouse_location IS NOT NULL AND trim(warehouse_location) <> ''
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO warehouse_inventory (tenant_id, warehouse_id, product_id, quantity, id, created_at, updated_at)
        SELECT p.tenant_id, w.id, p.id, p.quantity, gen_random_uuid(), now(), now()
        FROM products p
        JOIN warehouses w ON w.tenant_id = p.tenant_id AND w.name = p.warehouse_location
        WHERE p.tenant_id IS NOT NULL AND p.warehouse_location IS NOT NULL AND trim(p.warehouse_location) <> ''
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_stock_transfers_status"), table_name="stock_transfers")
    op.drop_index(op.f("ix_stock_transfers_tenant_id"), table_name="stock_transfers")
    op.drop_table("stock_transfers")
    op.drop_index(op.f("ix_warehouse_inventory_product_id"), table_name="warehouse_inventory")
    op.drop_index(op.f("ix_warehouse_inventory_warehouse_id"), table_name="warehouse_inventory")
    op.drop_index(op.f("ix_warehouse_inventory_tenant_id"), table_name="warehouse_inventory")
    op.drop_table("warehouse_inventory")
    op.drop_index(op.f("ix_warehouses_tenant_id"), table_name="warehouses")
    op.drop_table("warehouses")
