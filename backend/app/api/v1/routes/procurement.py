from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_tenant_roles
from app.core.enums import PurchaseOrderStatus, SupplierStatus, UserRole
from app.models.purchase_order import PurchaseOrder
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.procurement import (
    PurchaseOrderAnalytics,
    PurchaseOrderAuditLogOut,
    PurchaseOrderCreate,
    PurchaseOrderItemOut,
    PurchaseOrderListItem,
    PurchaseOrderOut,
    PurchaseOrderReceive,
    PurchaseOrderUpdate,
    SupplierCreate,
    SupplierOut,
    SupplierProfile,
    SupplierUpdate,
)
from app.services.procurement_service import ProcurementService

router = APIRouter(tags=["procurement"])
DbSession = Annotated[Session, Depends(get_db)]
ProcurementManager = Annotated[
    User,
    Depends(require_tenant_roles(UserRole.RETAILER_ADMIN, UserRole.PROCUREMENT_MANAGER)),
]
PageQuery = Annotated[int, Query(ge=1)]
LimitQuery = Annotated[int, Query(ge=1, le=100)]
SearchQuery = Annotated[str | None, Query(max_length=255)]
SupplierStatusQuery = Annotated[SupplierStatus | None, Query(alias="status")]
PurchaseOrderStatusQuery = Annotated[PurchaseOrderStatus | None, Query(alias="status")]
SupplierIdQuery = Annotated[UUID | None, Query()]


def _tenant_id(current_user: User) -> UUID:
    if current_user.tenant_id is None:
        raise ValueError("Operational users must be tenant-scoped.")
    return current_user.tenant_id


def _supplier_data(supplier: Supplier) -> dict:
    return SupplierOut.model_validate(supplier).model_dump(mode="json")


def _po_item_data(item) -> dict:
    line_total = float(item.unit_price) * item.quantity_ordered
    return PurchaseOrderItemOut(
        id=item.id,
        product_id=item.product_id,
        product_name=item.product.product_name,
        sku=item.product.sku,
        quantity_ordered=item.quantity_ordered,
        quantity_received=item.quantity_received,
        quantity_remaining=item.quantity_ordered - item.quantity_received,
        unit_price=float(item.unit_price),
        line_total=round(line_total, 2),
    ).model_dump(mode="json")


def _po_list_data(po: PurchaseOrder) -> dict:
    total_ordered = sum(item.quantity_ordered for item in po.items)
    total_received = sum(item.quantity_received for item in po.items)
    total_amount = sum(float(item.unit_price) * item.quantity_ordered for item in po.items)
    return PurchaseOrderListItem(
        id=po.id,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name,
        warehouse_id=po.warehouse_id,
        warehouse_name=po.warehouse.name if po.warehouse else None,
        po_number=po.po_number,
        status=po.status,
        expected_delivery_date=po.expected_delivery_date,
        created_at=po.created_at,
        total_ordered=total_ordered,
        total_received=total_received,
        total_amount=round(total_amount, 2),
    ).model_dump(mode="json")


def _po_detail_data(po: PurchaseOrder) -> dict:
    total_ordered = sum(item.quantity_ordered for item in po.items)
    total_received = sum(item.quantity_received for item in po.items)
    total_amount = sum(float(item.unit_price) * item.quantity_ordered for item in po.items)
    return PurchaseOrderOut(
        id=po.id,
        tenant_id=po.tenant_id,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name,
        warehouse_id=po.warehouse_id,
        warehouse_name=po.warehouse.name if po.warehouse else None,
        po_number=po.po_number,
        status=po.status,
        expected_delivery_date=po.expected_delivery_date,
        notes=po.notes,
        created_by=po.created_by,
        approved_by=po.approved_by,
        approved_at=po.approved_at,
        created_at=po.created_at,
        updated_at=po.updated_at,
        total_ordered=total_ordered,
        total_received=total_received,
        total_amount=round(total_amount, 2),
        items=[_po_item_data(item) for item in po.items],
        audit_logs=[
            PurchaseOrderAuditLogOut.model_validate(log).model_dump(mode="json")
            for log in sorted(po.audit_logs, key=lambda log: log.created_at, reverse=True)
        ],
    ).model_dump(mode="json")


@router.get("/suppliers", response_model=ApiResponse)
def list_suppliers(
    db: DbSession,
    current_user: ProcurementManager,
    search: SearchQuery = None,
    status_filter: SupplierStatusQuery = None,
    page: PageQuery = 1,
    limit: LimitQuery = 20,
) -> ApiResponse:
    suppliers, total = ProcurementService(db).list_suppliers(
        tenant_id=_tenant_id(current_user),
        search=search,
        status_filter=status_filter,
        limit=limit,
        offset=(page - 1) * limit,
    )
    return ApiResponse(
        message="Suppliers fetched successfully.",
        data=[_supplier_data(supplier) for supplier in suppliers],
        pagination={"page": page, "limit": limit, "total": total},
    )


@router.post("/suppliers", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    supplier = ProcurementService(db).create_supplier(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        payload=payload,
    )
    db.commit()
    db.refresh(supplier)
    return ApiResponse(message="Supplier created successfully.", data=_supplier_data(supplier))


@router.get("/suppliers/{supplier_id}", response_model=ApiResponse)
def get_supplier(supplier_id: UUID, db: DbSession, current_user: ProcurementManager) -> ApiResponse:
    supplier = ProcurementService(db).get_supplier(
        tenant_id=_tenant_id(current_user),
        supplier_id=supplier_id,
    )
    return ApiResponse(message="Supplier fetched successfully.", data=_supplier_data(supplier))


@router.get("/suppliers/{supplier_id}/profile", response_model=ApiResponse)
def get_supplier_profile(supplier_id: UUID, db: DbSession, current_user: ProcurementManager) -> ApiResponse:
    profile = ProcurementService(db).supplier_profile(
        tenant_id=_tenant_id(current_user),
        supplier_id=supplier_id,
    )
    data = SupplierProfile(
        supplier=SupplierOut.model_validate(profile["supplier"]),
        total_purchase_orders=profile["total_purchase_orders"],
        completed_purchase_orders=profile["completed_purchase_orders"],
        delayed_deliveries=profile["delayed_deliveries"],
        total_units_received=profile["total_units_received"],
        reliability_score=profile["reliability_score"],
        delivery_history=profile["delivery_history"],
    )
    return ApiResponse(message="Supplier profile fetched successfully.", data=data.model_dump(mode="json"))


@router.put("/suppliers/{supplier_id}", response_model=ApiResponse)
def update_supplier(
    supplier_id: UUID,
    payload: SupplierUpdate,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    supplier = ProcurementService(db).update_supplier(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        supplier_id=supplier_id,
        payload=payload,
    )
    db.commit()
    db.refresh(supplier)
    return ApiResponse(message="Supplier updated successfully.", data=_supplier_data(supplier))


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: UUID, db: DbSession, current_user: ProcurementManager) -> None:
    ProcurementService(db).delete_supplier(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        supplier_id=supplier_id,
    )
    db.commit()
    return None


@router.get("/purchase-orders/analytics", response_model=ApiResponse)
def purchase_order_analytics(db: DbSession, current_user: ProcurementManager) -> ApiResponse:
    data = PurchaseOrderAnalytics(
        **ProcurementService(db).analytics(tenant_id=_tenant_id(current_user))
    )
    return ApiResponse(
        message="Purchase order analytics fetched successfully.",
        data=data.model_dump(mode="json"),
    )


@router.get("/purchase-orders", response_model=ApiResponse)
def list_purchase_orders(
    db: DbSession,
    current_user: ProcurementManager,
    status_filter: PurchaseOrderStatusQuery = None,
    supplier_id: SupplierIdQuery = None,
    search: SearchQuery = None,
    page: PageQuery = 1,
    limit: LimitQuery = 20,
) -> ApiResponse:
    orders, total = ProcurementService(db).list_purchase_orders(
        tenant_id=_tenant_id(current_user),
        status_filter=status_filter,
        supplier_id=supplier_id,
        search=search,
        limit=limit,
        offset=(page - 1) * limit,
    )
    return ApiResponse(
        message="Purchase orders fetched successfully.",
        data=[_po_list_data(order) for order in orders],
        pagination={"page": page, "limit": limit, "total": total},
    )


@router.post("/purchase-orders", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    try:
        order = ProcurementService(db).create_purchase_order(
            tenant_id=_tenant_id(current_user),
            current_user=current_user,
            payload=payload,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Purchase order could not be saved.",
        ) from exc
    return ApiResponse(message="Purchase order created successfully.", data=_po_detail_data(order))


@router.get("/purchase-orders/{purchase_order_id}", response_model=ApiResponse)
def get_purchase_order(
    purchase_order_id: UUID,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    order = ProcurementService(db).get_purchase_order(
        tenant_id=_tenant_id(current_user),
        purchase_order_id=purchase_order_id,
    )
    return ApiResponse(message="Purchase order fetched successfully.", data=_po_detail_data(order))


@router.put("/purchase-orders/{purchase_order_id}", response_model=ApiResponse)
def update_purchase_order(
    purchase_order_id: UUID,
    payload: PurchaseOrderUpdate,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    order = ProcurementService(db).update_purchase_order(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        purchase_order_id=purchase_order_id,
        payload=payload,
    )
    db.commit()
    return ApiResponse(message="Purchase order updated successfully.", data=_po_detail_data(order))


@router.delete("/purchase-orders/{purchase_order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    purchase_order_id: UUID,
    db: DbSession,
    current_user: ProcurementManager,
) -> None:
    ProcurementService(db).delete_purchase_order(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        purchase_order_id=purchase_order_id,
    )
    db.commit()
    return None


@router.post("/purchase-orders/{purchase_order_id}/submit", response_model=ApiResponse)
def submit_purchase_order(
    purchase_order_id: UUID,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    order = ProcurementService(db).submit_purchase_order(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        purchase_order_id=purchase_order_id,
    )
    db.commit()
    return ApiResponse(
        message="Purchase order submitted successfully.",
        data=_po_detail_data(order),
    )


@router.post("/purchase-orders/{purchase_order_id}/approve", response_model=ApiResponse)
def approve_purchase_order(
    purchase_order_id: UUID,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    order = ProcurementService(db).approve_purchase_order(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        purchase_order_id=purchase_order_id,
    )
    db.commit()
    return ApiResponse(message="Purchase order approved successfully.", data=_po_detail_data(order))


@router.post("/purchase-orders/{purchase_order_id}/cancel", response_model=ApiResponse)
def cancel_purchase_order(
    purchase_order_id: UUID,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    order = ProcurementService(db).cancel_purchase_order(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        purchase_order_id=purchase_order_id,
    )
    db.commit()
    return ApiResponse(
        message="Purchase order cancelled successfully.",
        data=_po_detail_data(order),
    )


@router.post("/purchase-orders/{purchase_order_id}/receive", response_model=ApiResponse)
def receive_purchase_order(
    purchase_order_id: UUID,
    payload: PurchaseOrderReceive,
    db: DbSession,
    current_user: ProcurementManager,
) -> ApiResponse:
    order = ProcurementService(db).receive_purchase_order(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        purchase_order_id=purchase_order_id,
        payload=payload,
    )
    db.commit()
    return ApiResponse(message="Purchase order received successfully.", data=_po_detail_data(order))
