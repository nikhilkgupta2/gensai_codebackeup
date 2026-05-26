from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.warehouse import StockTransfer, StockTransferItem, Warehouse, WarehouseInventory


class WarehouseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, warehouse_id: UUID) -> Warehouse | None:
        return self.db.query(Warehouse).filter(Warehouse.id == warehouse_id).one_or_none()

    def get_by_name(self, tenant_id: UUID, name: str) -> Warehouse | None:
        return (
            self.db.query(Warehouse)
            .filter(Warehouse.tenant_id == tenant_id, func.lower(Warehouse.name) == name.lower())
            .one_or_none()
        )

    def get_by_code(self, tenant_id: UUID, code: str, exclude_id: UUID | None = None) -> Warehouse | None:
        query = self.db.query(Warehouse).filter(Warehouse.tenant_id == tenant_id, func.lower(Warehouse.code) == code.lower())
        if exclude_id:
            query = query.filter(Warehouse.id != exclude_id)
        return query.one_or_none()

    def list(self, tenant_id: UUID, search: str | None = None) -> list[Warehouse]:
        query = self.db.query(Warehouse).filter(Warehouse.tenant_id == tenant_id)
        if search:
            pattern = f"%{search}%"
            query = query.filter(or_(Warehouse.name.ilike(pattern), Warehouse.code.ilike(pattern), Warehouse.manager.ilike(pattern)))
        return query.order_by(Warehouse.name.asc()).all()

    def create(self, tenant_id: UUID, *, name: str, code: str, address: str | None, manager: str | None) -> Warehouse:
        warehouse = Warehouse(tenant_id=tenant_id, name=name, code=code, address=address, manager=manager)
        self.db.add(warehouse)
        self.db.flush()
        return warehouse

    def inventory_for_product(self, warehouse_id: UUID, product_id: UUID) -> WarehouseInventory | None:
        return (
            self.db.query(WarehouseInventory)
            .filter(WarehouseInventory.warehouse_id == warehouse_id, WarehouseInventory.product_id == product_id)
            .one_or_none()
        )

    def ensure_inventory(self, tenant_id: UUID, warehouse_id: UUID, product_id: UUID, quantity: int = 0) -> WarehouseInventory:
        item = self.inventory_for_product(warehouse_id, product_id)
        if item:
            return item
        item = WarehouseInventory(tenant_id=tenant_id, warehouse_id=warehouse_id, product_id=product_id, quantity=quantity)
        self.db.add(item)
        self.db.flush()
        return item

    def list_inventory(self, tenant_id: UUID, warehouse_id: UUID | None = None, search: str | None = None) -> list[WarehouseInventory]:
        query = (
            self.db.query(WarehouseInventory)
            .join(Product, Product.id == WarehouseInventory.product_id)
            .filter(WarehouseInventory.tenant_id == tenant_id)
        )
        if warehouse_id:
            query = query.filter(WarehouseInventory.warehouse_id == warehouse_id)
        if search:
            pattern = f"%{search}%"
            query = query.filter(or_(Product.product_name.ilike(pattern), Product.sku.ilike(pattern), Product.category.ilike(pattern)))
        return query.order_by(Product.product_name.asc()).all()

    def create_transfer(
        self,
        tenant_id: UUID,
        *,
        product_id: UUID,
        source_warehouse_id: UUID,
        destination_warehouse_id: UUID,
        quantity: int,
        requested_by: UUID | None,
        notes: str | None,
    ) -> StockTransfer:
        transfer = StockTransfer(
            tenant_id=tenant_id,
            product_id=product_id,
            source_warehouse_id=source_warehouse_id,
            destination_warehouse_id=destination_warehouse_id,
            quantity=quantity,
            requested_by=requested_by,
            notes=notes,
            status="pending",
        )
        self.db.add(transfer)
        self.db.flush()
        item = StockTransferItem(
            stock_transfer_id=transfer.id,
            product_id=product_id,
            quantity=quantity,
            approved_quantity=0,
        )
        self.db.add(item)
        self.db.flush()
        return transfer

    def get_transfer(self, transfer_id: UUID) -> StockTransfer | None:
        return self.db.query(StockTransfer).filter(StockTransfer.id == transfer_id).one_or_none()

    def ensure_transfer_item(self, transfer_id: UUID, product_id: UUID, quantity: int) -> StockTransferItem:
        item = (
            self.db.query(StockTransferItem)
            .filter(StockTransferItem.stock_transfer_id == transfer_id, StockTransferItem.product_id == product_id)
            .one_or_none()
        )
        if item:
            return item
        item = StockTransferItem(
            stock_transfer_id=transfer_id,
            product_id=product_id,
            quantity=quantity,
            approved_quantity=0,
        )
        self.db.add(item)
        self.db.flush()
        return item

    def list_transfers(self, tenant_id: UUID, status: str | None = None) -> list[StockTransfer]:
        query = self.db.query(StockTransfer).filter(StockTransfer.tenant_id == tenant_id)
        if status:
            query = query.filter(StockTransfer.status == status)
        return query.order_by(StockTransfer.created_at.desc()).limit(100).all()
