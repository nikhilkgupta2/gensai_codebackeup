from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.core.enums import (
    PurchaseOrderAuditAction,
    PurchaseOrderStatus,
    SupplierStatus,
    UserRole,
)
from app.models.inventory_transaction import InventoryTransaction
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderAuditLog, PurchaseOrderItem
from app.models.supplier import Supplier
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.procurement import (
    PurchaseOrderCreate,
    PurchaseOrderReceive,
    PurchaseOrderUpdate,
    SupplierCreate,
    SupplierUpdate,
)
from app.services.audit_service import AuditService
from app.services.warehouse_service import WarehouseService


class ProcurementService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit_logs = AuditService(db)
        self.warehouses = WarehouseService(db)

    def list_suppliers(
        self,
        *,
        tenant_id: UUID,
        search: str | None,
        status_filter: SupplierStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Supplier], int]:
        query = self.db.query(Supplier).filter(Supplier.tenant_id == tenant_id)
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Supplier.name.ilike(pattern),
                    Supplier.contact_name.ilike(pattern),
                    Supplier.contact_email.ilike(pattern),
                )
            )
        if status_filter is not None:
            query = query.filter(Supplier.status == status_filter.value)
        total = query.count()
        suppliers = query.order_by(Supplier.name.asc()).limit(limit).offset(offset).all()
        return suppliers, total

    def get_supplier(self, *, tenant_id: UUID, supplier_id: UUID) -> Supplier:
        supplier = (
            self.db.query(Supplier)
            .filter(Supplier.id == supplier_id, Supplier.tenant_id == tenant_id)
            .one_or_none()
        )
        if supplier is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found.")
        return supplier

    def supplier_profile(self, *, tenant_id: UUID, supplier_id: UUID) -> dict:
        supplier = self.get_supplier(tenant_id=tenant_id, supplier_id=supplier_id)
        orders = (
            self.db.query(PurchaseOrder)
            .options(selectinload(PurchaseOrder.items))
            .filter(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.supplier_id == supplier.id)
            .order_by(PurchaseOrder.created_at.desc())
            .limit(25)
            .all()
        )
        total_orders = len(orders)
        completed = sum(1 for order in orders if order.status == PurchaseOrderStatus.COMPLETED.value)
        delayed = sum(
            1
            for order in orders
            if order.expected_delivery_date
            and order.expected_delivery_date < datetime.now(UTC).date()
            and order.status in {
                PurchaseOrderStatus.PENDING.value,
                PurchaseOrderStatus.APPROVED.value,
                PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
            }
        )
        total_units_received = sum(sum(item.quantity_received for item in order.items) for order in orders)
        reliability_score = 100
        if total_orders:
            completion_ratio = completed / total_orders
            delay_penalty = min(40, int((delayed / total_orders) * 40))
            reliability_score = max(0, min(100, int(completion_ratio * 100) - delay_penalty))
        return {
            "supplier": supplier,
            "total_purchase_orders": total_orders,
            "completed_purchase_orders": completed,
            "delayed_deliveries": delayed,
            "total_units_received": total_units_received,
            "reliability_score": reliability_score,
            "delivery_history": [
                {
                    "purchase_order_id": order.id,
                    "po_number": order.po_number,
                    "status": order.status,
                    "expected_delivery_date": order.expected_delivery_date,
                    "created_at": order.created_at,
                    "total_ordered": sum(item.quantity_ordered for item in order.items),
                    "total_received": sum(item.quantity_received for item in order.items),
                    "total_amount": round(sum(float(item.unit_price) * item.quantity_ordered for item in order.items), 2),
                }
                for order in orders
            ],
        }

    def create_supplier(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        payload: SupplierCreate,
    ) -> Supplier:
        self._ensure_retailer_admin(current_user)
        supplier = Supplier(tenant_id=tenant_id, **payload.model_dump(mode="json"))
        self.db.add(supplier)
        self.db.flush()
        return supplier

    def update_supplier(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        supplier_id: UUID,
        payload: SupplierUpdate,
    ) -> Supplier:
        self._ensure_retailer_admin(current_user)
        supplier = self.get_supplier(tenant_id=tenant_id, supplier_id=supplier_id)
        for key, value in payload.model_dump(exclude_unset=True, mode="json").items():
            setattr(supplier, key, value)
        self.db.flush()
        return supplier

    def delete_supplier(self, *, tenant_id: UUID, current_user: User, supplier_id: UUID) -> None:
        self._ensure_retailer_admin(current_user)
        supplier = self.get_supplier(tenant_id=tenant_id, supplier_id=supplier_id)
        po_count = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(PurchaseOrder.supplier_id == supplier.id)
            .scalar()
            or 0
        )
        if po_count:
            supplier.status = SupplierStatus.INACTIVE.value
        else:
            self.db.delete(supplier)
        self.db.flush()

    def list_purchase_orders(
        self,
        *,
        tenant_id: UUID,
        status_filter: PurchaseOrderStatus | None,
        supplier_id: UUID | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[PurchaseOrder], int]:
        query = self._po_query(tenant_id)
        if status_filter is not None:
            query = query.filter(PurchaseOrder.status == status_filter.value)
        if supplier_id is not None:
            query = query.filter(PurchaseOrder.supplier_id == supplier_id)
        if search:
            query = query.filter(PurchaseOrder.po_number.ilike(f"%{search}%"))
        total = query.count()
        orders = (
            query.order_by(PurchaseOrder.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return orders, total

    def get_purchase_order(self, *, tenant_id: UUID, purchase_order_id: UUID) -> PurchaseOrder:
        order = (
            self._po_query(tenant_id)
            .filter(PurchaseOrder.id == purchase_order_id)
            .one_or_none()
        )
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase order not found.",
            )
        return order

    def create_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        payload: PurchaseOrderCreate,
    ) -> PurchaseOrder:
        self._ensure_retailer_admin(current_user)
        supplier = self.get_supplier(tenant_id=tenant_id, supplier_id=payload.supplier_id)
        if supplier.status != SupplierStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Purchase orders require an active supplier.",
            )
        self._validate_products(tenant_id, [item.product_id for item in payload.items])
        self._validate_warehouse(tenant_id, payload.warehouse_id)
        po = PurchaseOrder(
            tenant_id=tenant_id,
            supplier_id=payload.supplier_id,
            warehouse_id=payload.warehouse_id,
            po_number=self._next_po_number(tenant_id),
            expected_delivery_date=payload.expected_delivery_date,
            notes=payload.notes,
            created_by=current_user.id,
            status=PurchaseOrderStatus.DRAFT.value,
        )
        po.items = [
            PurchaseOrderItem(
                product_id=item.product_id,
                quantity_ordered=item.quantity_ordered,
                quantity_received=0,
                unit_price=item.unit_price,
            )
            for item in payload.items
        ]
        self.db.add(po)
        self.db.flush()
        self._audit(po, current_user, PurchaseOrderAuditAction.CREATED, "Purchase order created.")
        return self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=po.id)

    def update_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        purchase_order_id: UUID,
        payload: PurchaseOrderUpdate,
    ) -> PurchaseOrder:
        self._ensure_retailer_admin(current_user)
        po = self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=purchase_order_id)
        if po.status not in {PurchaseOrderStatus.DRAFT.value, PurchaseOrderStatus.PENDING.value}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft or pending purchase orders can be edited.",
            )
        data = payload.model_dump(exclude_unset=True)
        if "supplier_id" in data and data["supplier_id"] is not None:
            supplier = self.get_supplier(tenant_id=tenant_id, supplier_id=data["supplier_id"])
            if supplier.status != SupplierStatus.ACTIVE.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Purchase orders require an active supplier.",
                )
            po.supplier_id = data["supplier_id"]
        if "expected_delivery_date" in data:
            po.expected_delivery_date = data["expected_delivery_date"]
        if "warehouse_id" in data:
            self._validate_warehouse(tenant_id, data["warehouse_id"])
            po.warehouse_id = data["warehouse_id"]
        if "notes" in data:
            po.notes = data["notes"]
        if data.get("items") is not None:
            self._validate_products(tenant_id, [item.product_id for item in payload.items or []])
            po.items.clear()
            self.db.flush()
            po.items = [
                PurchaseOrderItem(
                    product_id=item.product_id,
                    quantity_ordered=item.quantity_ordered,
                    quantity_received=0,
                    unit_price=item.unit_price,
                )
                for item in payload.items or []
            ]
        self._audit(po, current_user, PurchaseOrderAuditAction.UPDATED, "Purchase order updated.")
        self.db.flush()
        return self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=po.id)

    def submit_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        purchase_order_id: UUID,
    ) -> PurchaseOrder:
        self._ensure_retailer_admin(current_user)
        po = self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=purchase_order_id)
        if po.status != PurchaseOrderStatus.DRAFT.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft purchase orders can be submitted.",
            )
        po.status = PurchaseOrderStatus.PENDING.value
        self._audit(
            po,
            current_user,
            PurchaseOrderAuditAction.SUBMITTED,
            "Purchase order submitted.",
        )
        self.db.flush()
        return po

    def approve_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        purchase_order_id: UUID,
    ) -> PurchaseOrder:
        self._ensure_retailer_admin(current_user)
        po = self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=purchase_order_id)
        if po.status not in {PurchaseOrderStatus.DRAFT.value, PurchaseOrderStatus.PENDING.value}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft or pending purchase orders can be approved.",
            )
        po.status = PurchaseOrderStatus.APPROVED.value
        po.approved_by = current_user.id
        po.approved_at = datetime.now(UTC)
        self._audit(po, current_user, PurchaseOrderAuditAction.APPROVED, "Purchase order approved.")
        self.audit_logs.record(
            tenant_id=tenant_id,
            actor_id=current_user.id,
            module="procurement",
            action="approved",
            entity_type="purchase_order",
            entity_id=po.id,
            old_value={"status": "pending"},
            new_value={"status": po.status},
            message=f"Purchase order {po.po_number} approved.",
        )
        self.db.flush()
        return po

    def cancel_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        purchase_order_id: UUID,
    ) -> PurchaseOrder:
        self._ensure_retailer_admin(current_user)
        po = self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=purchase_order_id)
        if po.status in {
            PurchaseOrderStatus.COMPLETED.value,
            PurchaseOrderStatus.CANCELLED.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This purchase order cannot be cancelled.",
            )
        po.status = PurchaseOrderStatus.CANCELLED.value
        self._audit(
            po,
            current_user,
            PurchaseOrderAuditAction.CANCELLED,
            "Purchase order cancelled.",
        )
        self.db.flush()
        return po

    def delete_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        purchase_order_id: UUID,
    ) -> None:
        self._ensure_retailer_admin(current_user)
        po = self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=purchase_order_id)
        if po.status != PurchaseOrderStatus.DRAFT.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft purchase orders can be deleted.",
            )
        self._audit(po, current_user, PurchaseOrderAuditAction.DELETED, "Purchase order deleted.")
        self.db.delete(po)
        self.db.flush()

    def receive_purchase_order(
        self,
        *,
        tenant_id: UUID,
        current_user: User,
        purchase_order_id: UUID,
        payload: PurchaseOrderReceive,
    ) -> PurchaseOrder:
        if current_user.role not in {
            UserRole.RETAILER_ADMIN,
            UserRole.INVENTORY_MANAGER,
            UserRole.PROCUREMENT_MANAGER,
        }:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to receive inventory.",
            )
        po = self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=purchase_order_id)
        if po.status not in {
            PurchaseOrderStatus.APPROVED.value,
            PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only approved purchase orders can receive inventory.",
            )
        items_by_id = {item.id: item for item in po.items}
        received_total = 0
        for line in payload.items:
            item = items_by_id.get(line.item_id)
            if item is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Receive line does not belong to this purchase order.",
                )
            remaining = item.quantity_ordered - item.quantity_received
            if line.quantity > remaining:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Received quantity exceeds remaining quantity.",
                )
            product = (
                self.db.query(Product)
                .filter(Product.id == item.product_id, Product.tenant_id == tenant_id)
                .with_for_update()
                .one_or_none()
            )
            if product is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Product not found.",
                )
            product.quantity += line.quantity
            if po.warehouse_id:
                self.warehouses.receive_product(tenant_id, po.warehouse_id, product, line.quantity)
            item.quantity_received += line.quantity
            received_total += line.quantity
            self.db.add(
                InventoryTransaction(
                    tenant_id=tenant_id,
                    product_id=item.product_id,
                    transaction_type="STOCK_IN",
                    quantity=line.quantity,
                    updated_by=current_user.id,
                    notes=payload.notes or f"Received against {po.po_number}",
                )
            )
        if received_total == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Receive quantity must be greater than zero.",
            )
        total_ordered = sum(item.quantity_ordered for item in po.items)
        total_received = sum(item.quantity_received for item in po.items)
        po.status = (
            PurchaseOrderStatus.COMPLETED.value
            if total_received >= total_ordered
            else PurchaseOrderStatus.PARTIALLY_RECEIVED.value
        )
        self._audit(
            po,
            current_user,
            PurchaseOrderAuditAction.RECEIVED,
            f"Received {received_total} units.",
        )
        self.db.flush()
        return self.get_purchase_order(tenant_id=tenant_id, purchase_order_id=po.id)

    def analytics(self, *, tenant_id: UUID) -> dict:
        today = datetime.now(UTC).date()
        pending = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status == PurchaseOrderStatus.PENDING.value,
            )
            .scalar()
            or 0
        )
        completed = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status == PurchaseOrderStatus.COMPLETED.value,
            )
            .scalar()
            or 0
        )
        total_orders = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(PurchaseOrder.tenant_id == tenant_id)
            .scalar()
            or 0
        )
        overdue = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status.in_(
                    [
                        PurchaseOrderStatus.PENDING.value,
                        PurchaseOrderStatus.APPROVED.value,
                        PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
                    ]
                ),
                PurchaseOrder.expected_delivery_date < today,
            )
            .scalar()
            or 0
        )
        rows = (
            self.db.query(
                Supplier.name,
                func.count(func.distinct(PurchaseOrder.id)).label("purchase_order_count"),
                func.coalesce(func.sum(PurchaseOrderItem.quantity_received), 0).label(
                    "units_received"
                ),
            )
            .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
            .join(PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
            .filter(PurchaseOrder.tenant_id == tenant_id)
            .group_by(Supplier.name)
            .order_by(func.count(PurchaseOrder.id).desc())
            .limit(8)
            .all()
        )
        return {
            "total_purchase_orders": int(total_orders),
            "pending_purchase_orders": int(pending),
            "completed_purchase_orders": int(completed),
            "overdue_orders": int(overdue),
            "supplier_activity": [
                {
                    "supplier_name": row.name,
                    "purchase_order_count": int(row.purchase_order_count or 0),
                    "units_received": int(row.units_received or 0),
                }
                for row in rows
            ],
        }

    def _po_query(self, tenant_id: UUID):
        return (
            self.db.query(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.warehouse),
                selectinload(PurchaseOrder.audit_logs),
            )
            .filter(PurchaseOrder.tenant_id == tenant_id)
        )

    def _next_po_number(self, tenant_id: UUID) -> str:
        count = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(PurchaseOrder.tenant_id == tenant_id)
            .scalar()
            or 0
        )
        return f"PO-{datetime.now(UTC):%Y%m%d}-{int(count) + 1:04d}"

    def _validate_products(self, tenant_id: UUID, product_ids: list[UUID]) -> None:
        if len(product_ids) != len(set(product_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate products are not allowed on a purchase order.",
            )
        count = (
            self.db.query(func.count(Product.id))
            .filter(Product.tenant_id == tenant_id, Product.id.in_(product_ids))
            .scalar()
            or 0
        )
        if int(count) != len(product_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All purchase order products must belong to this tenant.",
            )

    def _validate_warehouse(self, tenant_id: UUID, warehouse_id: UUID | None) -> None:
        if warehouse_id is None:
            return
        exists = (
            self.db.query(Warehouse.id)
            .filter(Warehouse.tenant_id == tenant_id, Warehouse.id == warehouse_id)
            .one_or_none()
        )
        if exists is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse destination must belong to this tenant.")

    def _audit(
        self,
        po: PurchaseOrder,
        actor: User,
        action: PurchaseOrderAuditAction,
        details: str,
    ) -> None:
        self.db.add(
            PurchaseOrderAuditLog(
                tenant_id=po.tenant_id,
                purchase_order_id=po.id,
                actor_id=actor.id,
                action=action.value,
                details=details,
            )
        )

    def _ensure_retailer_admin(self, current_user: User) -> None:
        if current_user.role not in {UserRole.RETAILER_ADMIN, UserRole.PROCUREMENT_MANAGER}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only retailer admins and procurement managers can manage procurement workflows.",
            )
