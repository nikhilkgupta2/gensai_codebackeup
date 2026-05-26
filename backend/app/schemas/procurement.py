from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.enums import PurchaseOrderAuditAction, PurchaseOrderStatus, SupplierStatus


class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=60)
    address: str | None = None
    status: SupplierStatus = SupplierStatus.ACTIVE
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=60)
    address: str | None = None
    status: SupplierStatus | None = None
    notes: str | None = None


class SupplierOut(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    address: str | None
    status: SupplierStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierDeliveryHistory(BaseModel):
    purchase_order_id: UUID
    po_number: str
    status: str
    expected_delivery_date: date | None
    created_at: datetime
    total_ordered: int
    total_received: int
    total_amount: float


class SupplierProfile(BaseModel):
    supplier: SupplierOut
    total_purchase_orders: int
    completed_purchase_orders: int
    delayed_deliveries: int
    total_units_received: int
    reliability_score: int
    delivery_history: list[SupplierDeliveryHistory]


class PurchaseOrderItemCreate(BaseModel):
    product_id: UUID
    quantity_ordered: int = Field(gt=0)
    unit_price: float = Field(ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    warehouse_id: UUID | None = None
    expected_delivery_date: date | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    supplier_id: UUID | None = None
    warehouse_id: UUID | None = None
    expected_delivery_date: date | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] | None = Field(default=None, min_length=1)


class PurchaseOrderReceiveItem(BaseModel):
    item_id: UUID
    quantity: int = Field(gt=0)


class PurchaseOrderReceive(BaseModel):
    items: list[PurchaseOrderReceiveItem] = Field(min_length=1)
    notes: str | None = None


class PurchaseOrderItemOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    sku: str
    quantity_ordered: int
    quantity_received: int
    quantity_remaining: int
    unit_price: float
    line_total: float


class PurchaseOrderAuditLogOut(BaseModel):
    id: UUID
    actor_id: UUID | None
    action: PurchaseOrderAuditAction
    details: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderOut(BaseModel):
    id: UUID
    tenant_id: UUID
    supplier_id: UUID
    supplier_name: str
    warehouse_id: UUID | None
    warehouse_name: str | None
    po_number: str
    status: PurchaseOrderStatus
    expected_delivery_date: date | None
    notes: str | None
    created_by: UUID | None
    approved_by: UUID | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    total_ordered: int
    total_received: int
    total_amount: float
    items: list[PurchaseOrderItemOut]
    audit_logs: list[PurchaseOrderAuditLogOut] = []


class PurchaseOrderListItem(BaseModel):
    id: UUID
    supplier_id: UUID
    supplier_name: str
    warehouse_id: UUID | None
    warehouse_name: str | None
    po_number: str
    status: PurchaseOrderStatus
    expected_delivery_date: date | None
    created_at: datetime
    total_ordered: int
    total_received: int
    total_amount: float


class PurchaseOrderAnalytics(BaseModel):
    total_purchase_orders: int
    pending_purchase_orders: int
    completed_purchase_orders: int
    overdue_orders: int
    supplier_activity: list[dict[str, int | str]]
