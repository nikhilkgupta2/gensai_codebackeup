from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import PurchaseOrderStatus
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import (
    AdminDashboard,
    AdminTenantDrilldown,
    AuditorDashboard,
    ProcurementDashboard,
    RetailerDashboard,
    WarehouseStaffDashboard,
)


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.repository = DashboardRepository(db)

    def retailer_dashboard(self, tenant_id: UUID) -> RetailerDashboard:
        return RetailerDashboard(
            total_products=self.repository.total_products(tenant_id),
            low_stock_products=self.repository.low_stock_products(tenant_id),
            total_inventory_quantity=self.repository.total_inventory_quantity(tenant_id),
            total_suppliers=self.repository.total_suppliers(tenant_id),
            total_purchase_orders=self.repository.total_purchase_orders(tenant_id),
            pending_purchase_orders=self.repository.purchase_order_status_count(
                PurchaseOrderStatus.PENDING.value,
                tenant_id,
            ),
            completed_purchase_orders=self.repository.purchase_order_status_count(
                PurchaseOrderStatus.COMPLETED.value,
                tenant_id,
            ),
            movement_summary=self.repository.movement_summary(tenant_id),
            category_stats=self.repository.category_stats(tenant_id),
            recent_transactions=self.repository.recent_transactions(tenant_id),
            supplier_activity=self.repository.supplier_activity(tenant_id),
            total_warehouses=self.repository.total_warehouses(tenant_id),
            pending_transfer_requests=self.repository.transfer_status_count(tenant_id, "pending"),
            warehouse_performance=self.repository.warehouse_performance(tenant_id),
            recent_scans=self.repository.scan_count_today(tenant_id),
            scan_activity=self.repository.recent_scans(tenant_id),
            pending_approvals=self.repository.pending_approval_count(tenant_id),
        )

    def warehouse_staff_dashboard(
        self,
        tenant_id: UUID,
        assigned_warehouse: str | None,
    ) -> WarehouseStaffDashboard:
        if not assigned_warehouse:
            return WarehouseStaffDashboard(
                assigned_warehouse=None,
                pending_receipts=0,
                pending_dispatches=0,
                todays_movements=0,
                low_stock_alerts=0,
                recent_scans=0,
                transfer_requests=0,
                daily_stock_in=0,
                daily_stock_out=0,
                inventory_items=[],
                recent_transactions=[],
                scan_activity=[],
                pending_transfer_requests=0,
            )

        movement = self.repository.todays_movements_by_warehouse(tenant_id, assigned_warehouse)
        recent_transactions = self.repository.recent_transactions(
            tenant_id,
            limit=8,
            warehouse_location=assigned_warehouse,
        )
        return WarehouseStaffDashboard(
            assigned_warehouse=assigned_warehouse,
            pending_receipts=self.repository.pending_receipts_by_warehouse(tenant_id, assigned_warehouse),
            pending_dispatches=movement["stock_out"],
            todays_movements=movement["count"],
            low_stock_alerts=self.repository.low_stock_products_by_warehouse(tenant_id, assigned_warehouse),
            recent_scans=self.repository.scan_count_today(tenant_id, assigned_warehouse),
            transfer_requests=self.repository.transfer_status_count(tenant_id, "pending"),
            pending_transfer_requests=self.repository.transfer_status_count(tenant_id, "pending"),
            daily_stock_in=movement["stock_in"],
            daily_stock_out=movement["stock_out"],
            inventory_items=self.repository.warehouse_inventory_items(tenant_id, assigned_warehouse),
            recent_transactions=recent_transactions,
            scan_activity=self.repository.recent_scans(tenant_id, warehouse_location=assigned_warehouse),
        )

    def auditor_dashboard(self, tenant_id: UUID) -> AuditorDashboard:
        return AuditorDashboard(
            total_inventory_units=self.repository.total_inventory_quantity(tenant_id),
            total_products=self.repository.total_products(tenant_id),
            transaction_volume=self.repository.transaction_volume(tenant_id),
            suspicious_adjustments=self.repository.suspicious_adjustments(tenant_id),
            low_stock_items=self.repository.low_stock_products(tenant_id),
            recent_activities=self.repository.recent_transactions(tenant_id, limit=10),
            warehouse_activity=self.repository.warehouse_activity_summary(tenant_id),
            most_active_users=self.repository.most_active_users(tenant_id),
            suspicious_flags=self.repository.suspicious_flags(tenant_id),
            movement_summary=self.repository.movement_summary(tenant_id),
            activity_trends=self.repository.activity_trends(tenant_id),
        )

    def procurement_dashboard(self, tenant_id: UUID) -> ProcurementDashboard:
        monthly = self.repository.monthly_purchasing_summary(tenant_id)
        return ProcurementDashboard(
            pending_purchase_orders=self.repository.purchase_order_status_count(
                PurchaseOrderStatus.PENDING.value,
                tenant_id,
            ),
            supplier_performance=self.repository.supplier_activity(tenant_id),
            incoming_shipments=self.repository.incoming_shipments(tenant_id),
            low_stock_products=self.repository.low_stock_products(tenant_id),
            reorder_recommendations=self.repository.reorder_recommendations(tenant_id),
            delayed_deliveries=self.repository.delayed_deliveries(tenant_id),
            monthly_purchase_total=monthly["purchase_total"],
            monthly_received_units=monthly["received_units"],
            recent_purchase_orders=self.repository.recent_purchase_orders(tenant_id),
        )
    def admin_dashboard(self) -> AdminDashboard:
        return AdminDashboard(
            total_tenants=self.repository.total_tenants(),
            active_tenants=self.repository.active_tenants(),
            total_users=self.repository.total_users(),
            total_products=self.repository.total_products(),
            total_inventory_quantity=self.repository.total_inventory_quantity(),
            total_suppliers=self.repository.total_suppliers(),
            total_purchase_orders=self.repository.total_purchase_orders(),
            pending_purchase_orders=self.repository.purchase_order_status_count(
                PurchaseOrderStatus.PENDING.value,
            ),
            completed_purchase_orders=self.repository.purchase_order_status_count(
                PurchaseOrderStatus.COMPLETED.value,
            ),
            low_stock_tenant_count=self.repository.low_stock_tenant_count(),
            movement_summary=self.repository.movement_summary(),
            platform_usage=self.repository.platform_usage(),
            tenant_summaries=self.repository.tenant_summaries(),
            recent_tenant_activity=self.repository.recent_tenant_activity(),
        )

    def admin_tenant_drilldown(self, tenant_id: UUID) -> AdminTenantDrilldown:
        tenant = self.repository.tenant_summary(tenant_id)
        if tenant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")

        return AdminTenantDrilldown(
            tenant=tenant,
            movement_summary=self.repository.movement_summary(tenant_id),
            low_stock_products=self.repository.low_stock_products(tenant_id),
            category_stats=self.repository.category_stats(tenant_id),
            activity_trends=self.repository.activity_trends(tenant_id),
        )
