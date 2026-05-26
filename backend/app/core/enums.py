from enum import StrEnum


class TenantStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class UserRole(StrEnum):
    SUPER_ADMIN = "super_admin"
    RETAILER_ADMIN = "retailer_admin"
    INVENTORY_MANAGER = "inventory_manager"
    WAREHOUSE_STAFF = "warehouse_staff"
    AUDITOR = "auditor"
    PROCUREMENT_MANAGER = "procurement_manager"


class SupplierStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class PurchaseOrderStatus(StrEnum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    PARTIALLY_RECEIVED = "partially_received"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PurchaseOrderAuditAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    CANCELLED = "cancelled"
    RECEIVED = "received"
    DELETED = "deleted"
