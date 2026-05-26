from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.inventory_transaction import InventoryTransaction
from app.models.warehouse import StockTransfer, Warehouse, WarehouseInventory
from app.repositories.product_repository import ProductRepository
from app.repositories.warehouse_repository import WarehouseRepository
from app.schemas.warehouse import StockTransferCreate, WarehouseCreate, WarehouseUpdate
from app.services.audit_service import AuditService


class WarehouseService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = WarehouseRepository(db)
        self.products = ProductRepository(db)
        self.audit = AuditService(db)

    def list_warehouses(self, tenant_id: UUID, search: str | None = None) -> list[Warehouse]:
        return self.repo.list(tenant_id, search)

    def create_warehouse(self, tenant_id: UUID, payload: WarehouseCreate) -> Warehouse:
        name = payload.name.strip()
        code = payload.code.strip().upper()
        if self.repo.get_by_name(tenant_id, name) or self.repo.get_by_code(tenant_id, code):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Warehouse name or code already exists.")
        return self.repo.create(tenant_id, name=name, code=code, address=payload.address, manager=payload.manager)

    def update_warehouse(self, tenant_id: UUID, warehouse_id: UUID, payload: WarehouseUpdate) -> Warehouse:
        warehouse = self._get_warehouse(tenant_id, warehouse_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("name"):
            existing = self.repo.get_by_name(tenant_id, str(data["name"]).strip())
            if existing and existing.id != warehouse.id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Warehouse name already exists.")
            warehouse.name = str(data["name"]).strip()
        if data.get("code"):
            code = str(data["code"]).strip().upper()
            if self.repo.get_by_code(tenant_id, code, warehouse.id):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Warehouse code already exists.")
            warehouse.code = code
        if "address" in data:
            warehouse.address = data["address"]
        if "manager" in data:
            warehouse.manager = data["manager"]
        return warehouse

    def delete_warehouse(self, tenant_id: UUID, warehouse_id: UUID) -> None:
        warehouse = self._get_warehouse(tenant_id, warehouse_id)
        has_stock = any(item.quantity > 0 for item in warehouse.inventory_items)
        has_transfers = bool(
            self.db.query(StockTransfer)
            .filter(
                StockTransfer.tenant_id == tenant_id,
                or_(StockTransfer.source_warehouse_id == warehouse_id, StockTransfer.destination_warehouse_id == warehouse_id),
            )
            .first()
        )
        if has_stock or has_transfers:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Warehouse with stock or transfer history cannot be deleted.")
        self.db.delete(warehouse)

    def list_inventory(self, tenant_id: UUID, warehouse_id: UUID | None = None, search: str | None = None) -> list[WarehouseInventory]:
        if warehouse_id:
            self._get_warehouse(tenant_id, warehouse_id)
        return self.repo.list_inventory(tenant_id, warehouse_id, search)

    def assign_product(
        self,
        tenant_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        quantity: int,
        actor_id: UUID | None = None,
    ) -> WarehouseInventory:
        warehouse = self._get_warehouse(tenant_id, warehouse_id)
        product = self._get_product(tenant_id, product_id)
        item = self.repo.ensure_inventory(tenant_id, warehouse.id, product.id, 0)
        previous_quantity = item.quantity
        item.quantity = quantity
        product.quantity = sum(
            inventory_item.quantity
            for inventory_item in self.repo.list_inventory(tenant_id, search=None)
            if inventory_item.product_id == product.id
        )
        if quantity > 0:
            product.warehouse_location = warehouse.name
        self.audit.record(
            tenant_id=tenant_id,
            actor_id=actor_id,
            module="warehouse",
            action="stock_assigned",
            entity_type="warehouse_inventory",
            entity_id=item.id,
            old_value={
                "quantity": previous_quantity,
                "warehouse": warehouse.name,
                "product_name": product.product_name,
            },
            new_value={
                "quantity": quantity,
                "warehouse": warehouse.name,
                "product_name": product.product_name,
            },
            message=f"Assigned {quantity} units of {product.product_name} to {warehouse.name}.",
        )
        return item

    def receive_product(self, tenant_id: UUID, warehouse_id: UUID, product: Product, quantity: int) -> WarehouseInventory:
        warehouse = self._get_warehouse(tenant_id, warehouse_id)
        item = self.repo.ensure_inventory(tenant_id, warehouse.id, product.id, 0)
        item.quantity += quantity
        if not product.warehouse_location:
            product.warehouse_location = warehouse.name
        return item

    def list_transfers(self, tenant_id: UUID, status_filter: str | None = None) -> list[StockTransfer]:
        return self.repo.list_transfers(tenant_id, status_filter)

    def create_transfer(self, tenant_id: UUID, payload: StockTransferCreate, requested_by: UUID | None) -> StockTransfer:
        product = self._get_product(tenant_id, payload.product_id)
        source = self._get_warehouse(tenant_id, payload.source_warehouse_id)
        destination = self._get_warehouse(tenant_id, payload.destination_warehouse_id)
        source_item = self._ensure_inventory_from_product(tenant_id, source, product)
        self.repo.ensure_inventory(tenant_id, destination.id, product.id, 0)
        if source_item.quantity < payload.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient source warehouse stock.")
        transfer = self.repo.create_transfer(
            tenant_id,
            product_id=product.id,
            source_warehouse_id=source.id,
            destination_warehouse_id=destination.id,
            quantity=payload.quantity,
            requested_by=requested_by,
            notes=payload.notes,
        )
        self.audit.record(
            tenant_id=tenant_id,
            actor_id=requested_by,
            module="warehouse",
            action="transfer_requested",
            entity_type="stock_transfer",
            entity_id=transfer.id,
            old_value=None,
            new_value={
                "status": "pending",
                "product_name": product.product_name,
                "quantity": payload.quantity,
                "source": source.name,
                "destination": destination.name,
            },
            message=f"Warehouse transfer requested for {product.product_name}.",
        )
        return transfer

    def transition_transfer(
        self,
        tenant_id: UUID,
        transfer_id: UUID,
        action: str,
        actor_id: UUID | None,
        admin_notes: str | None = None,
    ) -> StockTransfer:
        transfer = self._get_transfer(tenant_id, transfer_id)
        if action == "approve":
            if transfer.status != "pending":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending transfers can be approved.")
            moved_items = []
            for item in self._transfer_items(transfer):
                source_item = self.repo.ensure_inventory(tenant_id, transfer.source_warehouse_id, item.product_id, 0)
                destination_item = self.repo.ensure_inventory(tenant_id, transfer.destination_warehouse_id, item.product_id, 0)
                approved_quantity = min(item.quantity, source_item.quantity)
                if approved_quantity <= 0:
                    continue
                source_item.quantity -= approved_quantity
                destination_item.quantity += approved_quantity
                item.approved_quantity = approved_quantity
                moved_items.append(
                    {
                        "product_id": str(item.product_id),
                        "product_name": item.product.product_name,
                        "requested_quantity": item.quantity,
                        "approved_quantity": approved_quantity,
                    }
                )
                self.db.add(
                    InventoryTransaction(
                        tenant_id=tenant_id,
                        product_id=item.product_id,
                        transaction_type="STOCK_OUT",
                        quantity=approved_quantity,
                        updated_by=actor_id,
                        notes=f"Transfer to {transfer.destination_warehouse.name}: {transfer.id}",
                    )
                )
                self.db.add(
                    InventoryTransaction(
                        tenant_id=tenant_id,
                        product_id=item.product_id,
                        transaction_type="STOCK_IN",
                        quantity=approved_quantity,
                        updated_by=actor_id,
                        notes=f"Transfer from {transfer.source_warehouse.name}: {transfer.id}",
                    )
                )
            if not moved_items:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No stock is available to approve this transfer.")
            transfer.status = "approved"
            transfer.approved_by = actor_id
            transfer.approved_at = datetime.now(UTC)
            transfer.admin_notes = admin_notes
            self.audit.record(
                tenant_id=tenant_id,
                actor_id=actor_id,
                module="warehouse",
                action="approved",
                entity_type="stock_transfer",
                entity_id=transfer.id,
                old_value={"status": "pending"},
                new_value={"status": "approved", "items": moved_items, "admin_notes": admin_notes},
                message=f"Warehouse transfer approved for {transfer.product.product_name}.",
            )
            self.audit.record(
                tenant_id=tenant_id,
                actor_id=actor_id,
                module="inventory",
                action="transfer_stock_moved",
                entity_type="stock_transfer",
                entity_id=transfer.id,
                old_value={"source": transfer.source_warehouse.name, "destination": transfer.destination_warehouse.name},
                new_value={"items": moved_items},
                message=f"Moved stock from {transfer.source_warehouse.name} to {transfer.destination_warehouse.name}.",
            )
            return transfer
        if action == "cancel":
            if transfer.status in {"completed", "cancelled", "rejected"}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer cannot be cancelled.")
            previous_status = transfer.status
            transfer.status = "rejected" if previous_status == "pending" else "cancelled"
            transfer.rejected_by = actor_id
            transfer.rejected_at = datetime.now(UTC)
            transfer.admin_notes = admin_notes
            self.audit.record(
                tenant_id=tenant_id,
                actor_id=actor_id,
                module="warehouse",
                action="rejected" if previous_status == "pending" else "cancelled",
                entity_type="stock_transfer",
                entity_id=transfer.id,
                old_value={"status": previous_status},
                new_value={"status": transfer.status, "admin_notes": admin_notes},
                message=f"Warehouse transfer {'rejected' if previous_status == 'pending' else 'cancelled'} for {transfer.product.product_name}.",
            )
            return transfer
        if action == "complete":
            if transfer.status != "approved":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved transfers can be completed.")
            transfer.status = "completed"
            transfer.completed_at = datetime.now(UTC)
            self.audit.record(
                tenant_id=tenant_id,
                actor_id=actor_id,
                module="warehouse",
                action="completed",
                entity_type="stock_transfer",
                entity_id=transfer.id,
                old_value={"status": "approved"},
                new_value={"status": "completed"},
                message=f"Warehouse transfer completed for {transfer.product.product_name}.",
            )
            return transfer
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported transfer action.")

    def _transfer_items(self, transfer: StockTransfer):
        if transfer.items:
            return transfer.items
        item = self.repo.ensure_transfer_item(transfer.id, transfer.product_id, transfer.quantity)
        return [item]

    def adjust_product_warehouse_inventory(self, tenant_id: UUID, product: Product, delta: int) -> None:
        if not product.warehouse_location:
            return
        warehouse = self._get_or_create_from_location(tenant_id, product.warehouse_location)
        item = self.repo.ensure_inventory(tenant_id, warehouse.id, product.id, 0)
        if item.quantity + delta < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse inventory cannot become negative.")
        item.quantity += delta

    def _get_or_create_from_location(self, tenant_id: UUID, location: str) -> Warehouse:
        name = location.strip()
        warehouse = self.repo.get_by_name(tenant_id, name)
        if warehouse:
            return warehouse
        code = "".join(ch if ch.isalnum() else "-" for ch in name.upper()).strip("-")[:40] or "WAREHOUSE"
        unique_code = code
        suffix = 1
        while self.repo.get_by_code(tenant_id, unique_code):
            suffix += 1
            unique_code = f"{code[:34]}-{suffix}"
        return self.repo.create(tenant_id, name=name, code=unique_code, address=None, manager=None)

    def _ensure_inventory_from_product(self, tenant_id: UUID, warehouse: Warehouse, product: Product) -> WarehouseInventory:
        item = self.repo.inventory_for_product(warehouse.id, product.id)
        if item:
            return item
        quantity = product.quantity if product.warehouse_location == warehouse.name else 0
        return self.repo.ensure_inventory(tenant_id, warehouse.id, product.id, quantity)

    def _get_warehouse(self, tenant_id: UUID, warehouse_id: UUID) -> Warehouse:
        warehouse = self.repo.get(warehouse_id)
        if not warehouse or warehouse.tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found.")
        return warehouse

    def _get_product(self, tenant_id: UUID, product_id: UUID) -> Product:
        product = self.products.get_by_id(product_id)
        if not product or product.tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
        return product

    def _get_transfer(self, tenant_id: UUID, transfer_id: UUID) -> StockTransfer:
        transfer = self.repo.get_transfer(transfer_id)
        if not transfer or transfer.tenant_id != tenant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found.")
        return transfer
