from uuid import UUID

from sqlalchemy.orm import Session

from app.models.product import Product
from app.repositories.inventory_repository import InventoryRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.scan_repository import ScanRepository
from app.schemas.inventory import InventoryAdjustmentCreate, InventoryTransactionCreate
from app.services.audit_service import AuditService
from app.services.warehouse_service import WarehouseService


class InventoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.transactions = InventoryRepository(db)
        self.products = ProductRepository(db)
        self.scans = ScanRepository(db)
        self.audit = AuditService(db)
        self.warehouses = WarehouseService(db)

    def _get_product(
        self,
        product_id: UUID,
        tenant_id: UUID | None,
        warehouse_location: str | None = None,
    ) -> Product:
        product = self.products.get_by_id(product_id)
        if product is None:
            raise ValueError("Product not found")
        if tenant_id is not None and product.tenant_id != tenant_id:
            raise ValueError("Not allowed")
        if warehouse_location and product.warehouse_location != warehouse_location:
            raise ValueError("Product is outside your assigned warehouse")
        return product

    def stock_in(
        self,
        tenant_id: UUID,
        payload: InventoryTransactionCreate,
        updated_by: UUID | None,
        warehouse_location: str | None = None,
    ):
        product = self._get_product(payload.product_id, tenant_id, warehouse_location)
        product.quantity += payload.quantity
        self.warehouses.adjust_product_warehouse_inventory(tenant_id, product, payload.quantity)
        tx = self.transactions.create(
            tenant_id=product.tenant_id,
            product_id=payload.product_id,
            transaction_type="STOCK_IN",
            quantity=payload.quantity,
            updated_by=updated_by,
            notes=payload.notes,
        )
        self.audit.record(
            tenant_id=product.tenant_id,
            actor_id=updated_by,
            module="inventory",
            action="stock_in",
            entity_type="inventory_transaction",
            entity_id=tx.id,
            old_value={"quantity": product.quantity - payload.quantity},
            new_value={"quantity": product.quantity},
            message=f"Stock added for {product.product_name}.",
        )
        return tx

    def stock_out(
        self,
        tenant_id: UUID,
        payload: InventoryTransactionCreate,
        updated_by: UUID | None,
        warehouse_location: str | None = None,
    ):
        product = self._get_product(payload.product_id, tenant_id, warehouse_location)
        if payload.quantity > product.quantity:
            raise ValueError("Insufficient inventory quantity")
        old_quantity = product.quantity
        self.warehouses.adjust_product_warehouse_inventory(tenant_id, product, -payload.quantity)
        product.quantity -= payload.quantity
        tx = self.transactions.create(
            tenant_id=product.tenant_id,
            product_id=payload.product_id,
            transaction_type="STOCK_OUT",
            quantity=payload.quantity,
            updated_by=updated_by,
            notes=payload.notes,
        )
        self.audit.record(
            tenant_id=product.tenant_id,
            actor_id=updated_by,
            module="inventory",
            action="stock_out",
            entity_type="inventory_transaction",
            entity_id=tx.id,
            old_value={"quantity": old_quantity},
            new_value={"quantity": product.quantity},
            message=f"Stock removed for {product.product_name}.",
        )
        return tx

    def adjustment(
        self,
        tenant_id: UUID,
        payload: InventoryAdjustmentCreate,
        updated_by: UUID | None,
        warehouse_location: str | None = None,
    ):
        if payload.quantity == 0:
            raise ValueError("Adjustment quantity cannot be zero")
        product = self._get_product(payload.product_id, tenant_id, warehouse_location)
        if product.quantity + payload.quantity < 0:
            raise ValueError("Adjustment would make inventory quantity negative")
        old_quantity = product.quantity
        self.warehouses.adjust_product_warehouse_inventory(tenant_id, product, payload.quantity)
        product.quantity += payload.quantity
        tx = self.transactions.create(
            tenant_id=product.tenant_id,
            product_id=payload.product_id,
            transaction_type="ADJUSTMENT",
            quantity=payload.quantity,
            updated_by=updated_by,
            notes=payload.notes,
        )
        self.audit.record(
            tenant_id=product.tenant_id,
            actor_id=updated_by,
            module="inventory",
            action="adjustment",
            entity_type="inventory_transaction",
            entity_id=tx.id,
            old_value={"quantity": old_quantity},
            new_value={"quantity": product.quantity},
            message=f"Inventory adjusted for {product.product_name}.",
        )
        return tx

    def history(
        self,
        tenant_id: UUID | None,
        product_id: UUID | None = None,
        warehouse_location: str | None = None,
        transaction_type: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ):
        if product_id is not None:
            self._get_product(product_id, tenant_id, warehouse_location)
        return self.transactions.list_by_tenant(
            tenant_id=tenant_id,
            product_id=product_id,
            warehouse_location=warehouse_location,
            transaction_type=transaction_type,
            search=search,
            limit=limit,
            offset=offset,
        )

    def scan_product(
        self,
        tenant_id: UUID,
        code: str,
        scanned_by: UUID | None,
        warehouse_location: str | None = None,
        source: str = "manual",
    ):
        normalized = code.strip()
        if not normalized:
            raise ValueError("Scan code is required")

        candidates = self.products.list_by_tenant(
            tenant_id=tenant_id,
            limit=10,
            sku=normalized,
            warehouse_location=warehouse_location,
        )
        product = next(iter(candidates), None)
        if product is None:
            candidates = self.products.list_by_tenant(
                tenant_id=tenant_id,
                limit=10,
                product_name=normalized,
                warehouse_location=warehouse_location,
            )
            product = next(iter(candidates), None)
        if product is None:
            raise ValueError("No product matched that barcode or SKU")

        return self.scans.create(
            tenant_id=tenant_id,
            product_id=product.id,
            scanned_by=scanned_by,
            code=normalized,
            source=source.strip() or "manual",
        )
