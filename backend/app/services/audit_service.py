from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import PurchaseOrderStatus
from app.models.audit_log import AuditLog, StockAdjustmentRequest
from app.models.inventory_transaction import InventoryTransaction
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder
from app.models.user import User
from app.models.warehouse import StockTransfer
from app.repositories.warehouse_repository import WarehouseRepository
from app.schemas.audit import StockAdjustmentRequestCreate


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def record(
        self,
        *,
        tenant_id: UUID | None,
        actor_id: UUID | None,
        module: str,
        action: str,
        entity_type: str,
        entity_id: UUID | None,
        old_value: dict | None = None,
        new_value: dict | None = None,
        message: str | None = None,
    ) -> AuditLog:
        log = AuditLog(
            tenant_id=tenant_id,
            actor_id=actor_id,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            message=message,
        )
        self.db.add(log)
        self.db.flush()
        return log

    def list_logs(self, current_user: User, limit: int = 100, offset: int = 0) -> list[AuditLog]:
        query = self.db.query(AuditLog)
        if current_user.role.value != "super_admin":
            query = query.filter(AuditLog.tenant_id == current_user.tenant_id)
        return query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()


class ApprovalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit = AuditService(db)
        self.warehouses = WarehouseRepository(db)

    def request_stock_adjustment(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        payload: StockAdjustmentRequestCreate,
    ) -> StockAdjustmentRequest:
        product = self._get_product(tenant_id, payload.product_id)
        request = StockAdjustmentRequest(
            tenant_id=tenant_id,
            product_id=product.id,
            quantity=payload.quantity,
            notes=payload.notes,
            requested_by=current_user.id,
            status="pending",
        )
        self.db.add(request)
        self.db.flush()
        self.audit.record(
            tenant_id=tenant_id,
            actor_id=current_user.id,
            module="inventory",
            action="approval_requested",
            entity_type="stock_adjustment_request",
            entity_id=request.id,
            old_value=None,
            new_value={"product_id": str(product.id), "quantity": request.quantity, "status": request.status},
            message=f"Stock adjustment requested for {product.product_name}.",
        )
        return request

    def approval_queue(self, tenant_id: UUID) -> list[dict]:
        items: list[dict] = []
        for request in (
            self.db.query(StockAdjustmentRequest)
            .filter(StockAdjustmentRequest.tenant_id == tenant_id, StockAdjustmentRequest.status == "pending")
            .order_by(StockAdjustmentRequest.created_at.desc())
            .all()
        ):
            items.append(
                {
                    "id": request.id,
                    "type": "stock_adjustment",
                    "title": "Stock adjustment request",
                    "description": f"{request.product.product_name}: {request.quantity:+d} units",
                    "status": request.status,
                    "requested_by": request.requested_by,
                    "requested_by_name": request.requester.name if request.requester else None,
                    "created_at": request.created_at,
                    "metadata": {"product_id": str(request.product_id), "notes": request.notes},
                }
            )
        for transfer in (
            self.db.query(StockTransfer)
            .filter(StockTransfer.tenant_id == tenant_id, StockTransfer.status == "pending")
            .order_by(StockTransfer.created_at.desc())
            .all()
        ):
            items.append(
                {
                    "id": transfer.id,
                    "type": "warehouse_transfer",
                    "title": "Warehouse transfer",
                    "description": f"{transfer.product.product_name}: {transfer.quantity} units",
                    "status": transfer.status,
                    "requested_by": transfer.requested_by,
                    "requested_by_name": None,
                    "created_at": transfer.created_at,
                    "metadata": {
                        "source": transfer.source_warehouse.name,
                        "destination": transfer.destination_warehouse.name,
                    },
                }
            )
        for order in (
            self.db.query(PurchaseOrder)
            .filter(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.status == PurchaseOrderStatus.PENDING.value)
            .order_by(PurchaseOrder.created_at.desc())
            .all()
        ):
            items.append(
                {
                    "id": order.id,
                    "type": "purchase_order",
                    "title": "Purchase order approval",
                    "description": f"{order.po_number} from {order.supplier.name}",
                    "status": order.status,
                    "requested_by": order.created_by,
                    "requested_by_name": None,
                    "created_at": order.created_at,
                    "metadata": {"po_number": order.po_number},
                }
            )
        return sorted(items, key=lambda item: item["created_at"], reverse=True)

    def approve_stock_adjustment(self, tenant_id: UUID, request_id: UUID, actor: User) -> StockAdjustmentRequest:
        request = self._get_adjustment_request(tenant_id, request_id)
        if request.status != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending adjustment requests can be approved.")
        product = self._get_product(tenant_id, request.product_id)
        old_quantity = product.quantity
        if product.quantity + request.quantity < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adjustment would make inventory quantity negative.")
        self._adjust_warehouse_inventory(tenant_id, product, request.quantity)
        product.quantity += request.quantity
        request.status = "approved"
        request.approved_by = actor.id
        tx = InventoryTransaction(
            tenant_id=tenant_id,
            product_id=product.id,
            transaction_type="ADJUSTMENT",
            quantity=request.quantity,
            updated_by=actor.id,
            notes=request.notes or "Approved stock adjustment request.",
        )
        self.db.add(tx)
        self.db.flush()
        self.audit.record(
            tenant_id=tenant_id,
            actor_id=actor.id,
            module="inventory",
            action="approved",
            entity_type="stock_adjustment_request",
            entity_id=request.id,
            old_value={"quantity": old_quantity, "status": "pending"},
            new_value={"quantity": product.quantity, "status": "approved"},
            message=f"Approved stock adjustment for {product.product_name}.",
        )
        return request

    def reject_stock_adjustment(self, tenant_id: UUID, request_id: UUID, actor: User) -> StockAdjustmentRequest:
        request = self._get_adjustment_request(tenant_id, request_id)
        if request.status != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending adjustment requests can be rejected.")
        request.status = "rejected"
        request.rejected_by = actor.id
        self.audit.record(
            tenant_id=tenant_id,
            actor_id=actor.id,
            module="inventory",
            action="rejected",
            entity_type="stock_adjustment_request",
            entity_id=request.id,
            old_value={"status": "pending"},
            new_value={"status": "rejected"},
            message="Rejected stock adjustment request.",
        )
        self.db.flush()
        return request

    def pending_count(self, tenant_id: UUID) -> int:
        return len(self.approval_queue(tenant_id))

    def _get_adjustment_request(self, tenant_id: UUID, request_id: UUID) -> StockAdjustmentRequest:
        request = (
            self.db.query(StockAdjustmentRequest)
            .filter(StockAdjustmentRequest.tenant_id == tenant_id, StockAdjustmentRequest.id == request_id)
            .one_or_none()
        )
        if request is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adjustment request not found.")
        return request

    def _get_product(self, tenant_id: UUID, product_id: UUID) -> Product:
        product = self.db.query(Product).filter(Product.tenant_id == tenant_id, Product.id == product_id).one_or_none()
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
        return product

    def _adjust_warehouse_inventory(self, tenant_id: UUID, product: Product, delta: int) -> None:
        if not product.warehouse_location:
            return
        warehouse = self.warehouses.get_by_name(tenant_id, product.warehouse_location)
        if warehouse is None:
            return
        item = self.warehouses.ensure_inventory(tenant_id, warehouse.id, product.id, 0)
        if item.quantity + delta < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse inventory cannot become negative.")
        item.quantity += delta
