from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DashboardRecentTransaction(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    transaction_type: str
    quantity: int
    notes: str | None
    created_at: datetime


class DashboardScanActivity(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    sku: str
    code: str
    source: str
    created_at: datetime


class DashboardMovementSummary(BaseModel):
    stock_in: int = 0
    stock_out: int = 0
    adjustment: int = 0


class DashboardCategoryStat(BaseModel):
    category: str
    product_count: int
    total_quantity: int


class DashboardTenantSummary(BaseModel):
    tenant_id: UUID
    company_name: str
    active_users: int
    product_count: int
    inventory_units: int
    last_activity_at: datetime | None
    status: str


class DashboardTenantActivitySummary(BaseModel):
    tenant_id: UUID
    company_name: str
    activity_count: int
    last_activity_at: datetime | None
    status: str


class DashboardPlatformUsage(BaseModel):
    tenants_with_products: int
    tenants_with_recent_activity: int
    average_products_per_tenant: float
    low_stock_tenant_count: int


class DashboardActivityTrend(BaseModel):
    period: str
    transaction_count: int
    units_moved: int


class DashboardSupplierActivity(BaseModel):
    supplier_name: str
    purchase_order_count: int
    units_received: int


class DashboardWarehousePerformance(BaseModel):
    warehouse_id: UUID
    name: str
    code: str
    product_count: int
    total_units: int
    low_stock_items: int


class WarehouseInventoryItem(BaseModel):
    id: UUID
    product_name: str
    sku: str
    quantity: int
    warehouse_location: str | None
    stock_status: str


class WarehouseStaffDashboard(BaseModel):
    assigned_warehouse: str | None
    pending_receipts: int
    pending_dispatches: int
    todays_movements: int
    low_stock_alerts: int
    recent_scans: int
    transfer_requests: int
    daily_stock_in: int
    daily_stock_out: int
    inventory_items: list[WarehouseInventoryItem]
    recent_transactions: list[DashboardRecentTransaction]
    scan_activity: list[DashboardScanActivity] = []
    pending_transfer_requests: int = 0

    model_config = ConfigDict(from_attributes=True)


class AuditorWarehouseActivity(BaseModel):
    warehouse_location: str
    transaction_count: int
    stock_in: int
    stock_out: int
    adjustments: int


class AuditorActiveUser(BaseModel):
    user_id: UUID | None
    user_name: str
    activity_count: int
    last_activity_at: datetime | None


class AuditorFlag(BaseModel):
    id: UUID
    product_name: str
    transaction_type: str
    quantity: int
    notes: str | None
    created_at: datetime
    reason: str


class AuditorDashboard(BaseModel):
    total_inventory_units: int
    total_products: int
    transaction_volume: int
    suspicious_adjustments: int
    low_stock_items: int
    recent_activities: list[DashboardRecentTransaction]
    warehouse_activity: list[AuditorWarehouseActivity]
    most_active_users: list[AuditorActiveUser]
    suspicious_flags: list[AuditorFlag]
    movement_summary: DashboardMovementSummary
    activity_trends: list[DashboardActivityTrend]

    model_config = ConfigDict(from_attributes=True)


class ProcurementReorderRecommendation(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    quantity: int
    recommended_quantity: int
    warehouse_location: str | None


class ProcurementDashboard(BaseModel):
    pending_purchase_orders: int
    supplier_performance: list[DashboardSupplierActivity]
    incoming_shipments: int
    low_stock_products: int
    reorder_recommendations: list[ProcurementReorderRecommendation]
    delayed_deliveries: int
    monthly_purchase_total: float
    monthly_received_units: int
    recent_purchase_orders: list[dict]

    model_config = ConfigDict(from_attributes=True)


class RetailerDashboard(BaseModel):
    total_products: int
    low_stock_products: int
    total_inventory_quantity: int
    total_suppliers: int
    total_purchase_orders: int
    pending_purchase_orders: int
    completed_purchase_orders: int
    movement_summary: DashboardMovementSummary
    category_stats: list[DashboardCategoryStat]
    recent_transactions: list[DashboardRecentTransaction]
    supplier_activity: list[DashboardSupplierActivity]
    total_warehouses: int = 0
    pending_transfer_requests: int = 0
    warehouse_performance: list[DashboardWarehousePerformance] = []
    recent_scans: int = 0
    scan_activity: list[DashboardScanActivity] = []
    pending_approvals: int = 0

    model_config = ConfigDict(from_attributes=True)


class AdminDashboard(BaseModel):
    total_tenants: int
    active_tenants: int
    total_users: int
    total_products: int
    total_inventory_quantity: int
    total_suppliers: int
    total_purchase_orders: int
    pending_purchase_orders: int
    completed_purchase_orders: int
    low_stock_tenant_count: int
    movement_summary: DashboardMovementSummary
    platform_usage: DashboardPlatformUsage
    tenant_summaries: list[DashboardTenantSummary]
    recent_tenant_activity: list[DashboardTenantActivitySummary]

    model_config = ConfigDict(from_attributes=True)


class AdminTenantDrilldown(BaseModel):
    tenant: DashboardTenantSummary
    movement_summary: DashboardMovementSummary
    low_stock_products: int
    category_stats: list[DashboardCategoryStat]
    activity_trends: list[DashboardActivityTrend]

    model_config = ConfigDict(from_attributes=True)
