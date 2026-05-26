from typing import Iterable
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.inventory_transaction import InventoryTransaction
from app.models.product import Product


class InventoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, tx_id: UUID) -> InventoryTransaction | None:
        return self.db.query(InventoryTransaction).filter(InventoryTransaction.id == tx_id).one_or_none()

    def list_by_tenant(
        self,
        tenant_id: UUID | None,
        product_id: UUID | None = None,
        warehouse_location: str | None = None,
        transaction_type: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Iterable[InventoryTransaction]:
        q = self.db.query(InventoryTransaction)
        if tenant_id is not None:
            q = q.filter(InventoryTransaction.tenant_id == tenant_id)
        if product_id is not None:
            q = q.filter(InventoryTransaction.product_id == product_id)
        if transaction_type:
            q = q.filter(InventoryTransaction.transaction_type == transaction_type)
        if warehouse_location or search:
            q = q.join(Product, Product.id == InventoryTransaction.product_id)
        if warehouse_location:
            q = q.filter(Product.warehouse_location == warehouse_location)
        if search:
            pattern = f"%{search}%"
            q = q.filter(
                or_(
                    Product.product_name.ilike(pattern),
                    Product.sku.ilike(pattern),
                    Product.category.ilike(pattern),
                    InventoryTransaction.notes.ilike(pattern),
                )
            )
        return q.order_by(InventoryTransaction.created_at.desc()).limit(limit).offset(offset).all()

    def create(
        self,
        *,
        tenant_id: UUID | None,
        product_id: UUID,
        transaction_type: str,
        quantity: int,
        updated_by: UUID | None = None,
        notes: str | None = None,
    ) -> InventoryTransaction:
        tx = InventoryTransaction(
            tenant_id=tenant_id,
            product_id=product_id,
            transaction_type=transaction_type,
            quantity=quantity,
            updated_by=updated_by,
            notes=notes,
        )
        self.db.add(tx)
        self.db.flush()
        return tx
