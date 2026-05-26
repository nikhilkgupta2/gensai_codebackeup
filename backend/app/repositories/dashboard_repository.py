from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.enums import PurchaseOrderStatus, TenantStatus
from app.models.audit_log import StockAdjustmentRequest
from app.models.inventory_transaction import InventoryTransaction
from app.models.product import Product
from app.models.product_scan_log import ProductScanLog
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.supplier import Supplier
from app.models.tenant import Tenant
from app.models.user import User
from app.models.warehouse import StockTransfer, Warehouse, WarehouseInventory


class DashboardRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def total_products(self, tenant_id: UUID | None = None) -> int:
        query = self.db.query(func.count(Product.id))
        if tenant_id is not None:
            query = query.filter(Product.tenant_id == tenant_id)
        return int(query.scalar() or 0)

    def low_stock_products(self, tenant_id: UUID) -> int:
        return int(
            self.db.query(func.count(Product.id))
            .filter(Product.tenant_id == tenant_id, Product.quantity <= 10)
            .scalar()
            or 0
        )

    def low_stock_products_by_warehouse(self, tenant_id: UUID, warehouse_location: str) -> int:
        return int(
            self.db.query(func.count(Product.id))
            .filter(
                Product.tenant_id == tenant_id,
                Product.warehouse_location == warehouse_location,
                Product.quantity <= 10,
            )
            .scalar()
            or 0
        )

    def total_inventory_quantity(self, tenant_id: UUID | None = None) -> int:
        query = self.db.query(func.coalesce(func.sum(Product.quantity), 0))
        if tenant_id is not None:
            query = query.filter(Product.tenant_id == tenant_id)
        return int(query.scalar() or 0)

    def total_suppliers(self, tenant_id: UUID | None = None) -> int:
        query = self.db.query(func.count(Supplier.id))
        if tenant_id is not None:
            query = query.filter(Supplier.tenant_id == tenant_id)
        return int(query.scalar() or 0)

    def total_purchase_orders(self, tenant_id: UUID | None = None) -> int:
        query = self.db.query(func.count(PurchaseOrder.id))
        if tenant_id is not None:
            query = query.filter(PurchaseOrder.tenant_id == tenant_id)
        return int(query.scalar() or 0)

    def total_warehouses(self, tenant_id: UUID) -> int:
        return int(self.db.query(func.count(Warehouse.id)).filter(Warehouse.tenant_id == tenant_id).scalar() or 0)

    def transfer_status_count(self, tenant_id: UUID, status: str | None = None) -> int:
        query = self.db.query(func.count(StockTransfer.id)).filter(StockTransfer.tenant_id == tenant_id)
        if status:
            query = query.filter(StockTransfer.status == status)
        return int(query.scalar() or 0)

    def pending_approval_count(self, tenant_id: UUID) -> int:
        stock_adjustments = (
            self.db.query(func.count(StockAdjustmentRequest.id))
            .filter(StockAdjustmentRequest.tenant_id == tenant_id, StockAdjustmentRequest.status == "pending")
            .scalar()
            or 0
        )
        transfers = (
            self.db.query(func.count(StockTransfer.id))
            .filter(StockTransfer.tenant_id == tenant_id, StockTransfer.status == "pending")
            .scalar()
            or 0
        )
        purchase_orders = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.status == PurchaseOrderStatus.PENDING.value)
            .scalar()
            or 0
        )
        return int(stock_adjustments or 0) + int(transfers or 0) + int(purchase_orders or 0)

    def warehouse_performance(self, tenant_id: UUID, limit: int = 6) -> list[dict]:
        rows = (
            self.db.query(
                Warehouse.id,
                Warehouse.name,
                Warehouse.code,
                func.count(WarehouseInventory.product_id).label("product_count"),
                func.coalesce(func.sum(WarehouseInventory.quantity), 0).label("total_units"),
                func.coalesce(func.sum(case((WarehouseInventory.quantity <= 10, 1), else_=0)), 0).label("low_stock_items"),
            )
            .outerjoin(WarehouseInventory, WarehouseInventory.warehouse_id == Warehouse.id)
            .filter(Warehouse.tenant_id == tenant_id)
            .group_by(Warehouse.id, Warehouse.name, Warehouse.code)
            .order_by(func.coalesce(func.sum(WarehouseInventory.quantity), 0).desc(), Warehouse.name.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "warehouse_id": row.id,
                "name": row.name,
                "code": row.code,
                "product_count": int(row.product_count or 0),
                "total_units": int(row.total_units or 0),
                "low_stock_items": int(row.low_stock_items or 0),
            }
            for row in rows
        ]

    def purchase_order_status_count(self, status: str, tenant_id: UUID | None = None) -> int:
        query = self.db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status == status)
        if tenant_id is not None:
            query = query.filter(PurchaseOrder.tenant_id == tenant_id)
        return int(query.scalar() or 0)

    def supplier_activity(self, tenant_id: UUID, limit: int = 6) -> list[dict[str, int | str]]:
        rows = (
            self.db.query(
                Supplier.name.label("supplier_name"),
                func.count(func.distinct(PurchaseOrder.id)).label("purchase_order_count"),
                func.coalesce(func.sum(PurchaseOrderItem.quantity_received), 0).label(
                    "units_received"
                ),
            )
            .outerjoin(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
            .outerjoin(PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
            .filter(Supplier.tenant_id == tenant_id)
            .group_by(Supplier.id, Supplier.name)
            .order_by(func.count(func.distinct(PurchaseOrder.id)).desc(), Supplier.name.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "supplier_name": row.supplier_name,
                "purchase_order_count": int(row.purchase_order_count or 0),
                "units_received": int(row.units_received or 0),
            }
            for row in rows
        ]

    def movement_summary(self, tenant_id: UUID | None = None) -> dict[str, int]:
        query = self.db.query(
            func.coalesce(
                func.sum(
                    case(
                        (
                            InventoryTransaction.transaction_type == "STOCK_IN",
                            InventoryTransaction.quantity,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            InventoryTransaction.transaction_type == "STOCK_OUT",
                            InventoryTransaction.quantity,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            InventoryTransaction.transaction_type == "ADJUSTMENT",
                            InventoryTransaction.quantity,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        if tenant_id is not None:
            query = query.filter(InventoryTransaction.tenant_id == tenant_id)
        stock_in, stock_out, adjustment = query.one()
        return {
            "stock_in": int(stock_in or 0),
            "stock_out": int(stock_out or 0),
            "adjustment": int(adjustment or 0),
        }

    def category_stats(self, tenant_id: UUID) -> list[dict[str, int | str]]:
        category = func.coalesce(Product.category, "Uncategorized")
        rows = (
            self.db.query(
                category,
                func.count(Product.id),
                func.coalesce(func.sum(Product.quantity), 0),
            )
            .filter(Product.tenant_id == tenant_id)
            .group_by(category)
            .order_by(func.count(Product.id).desc())
            .limit(8)
            .all()
        )
        return [
            {
                "category": category,
                "product_count": int(count),
                "total_quantity": int(quantity or 0),
            }
            for category, count, quantity in rows
        ]

    def recent_transactions(
        self,
        tenant_id: UUID | None = None,
        limit: int = 8,
        warehouse_location: str | None = None,
    ) -> list[dict]:
        query = (
            self.db.query(
                InventoryTransaction.id,
                InventoryTransaction.product_id,
                Product.product_name,
                InventoryTransaction.transaction_type,
                InventoryTransaction.quantity,
                InventoryTransaction.notes,
                InventoryTransaction.created_at,
            )
            .join(Product, Product.id == InventoryTransaction.product_id)
            .order_by(InventoryTransaction.created_at.desc())
        )
        if tenant_id is not None:
            query = query.filter(InventoryTransaction.tenant_id == tenant_id)
        if warehouse_location:
            query = query.filter(Product.warehouse_location == warehouse_location)
        query = query.limit(limit)
        return [
            {
                "id": row.id,
                "product_id": row.product_id,
                "product_name": row.product_name,
                "transaction_type": row.transaction_type,
                "quantity": row.quantity,
                "notes": row.notes,
                "created_at": row.created_at,
            }
            for row in query.all()
        ]

    def recent_scans(
        self,
        tenant_id: UUID,
        limit: int = 8,
        warehouse_location: str | None = None,
    ) -> list[dict]:
        query = (
            self.db.query(
                ProductScanLog.id,
                ProductScanLog.product_id,
                Product.product_name,
                Product.sku,
                ProductScanLog.code,
                ProductScanLog.source,
                ProductScanLog.created_at,
            )
            .join(Product, Product.id == ProductScanLog.product_id)
            .filter(ProductScanLog.tenant_id == tenant_id)
            .order_by(ProductScanLog.created_at.desc())
        )
        if warehouse_location:
            query = query.filter(Product.warehouse_location == warehouse_location)
        return [
            {
                "id": row.id,
                "product_id": row.product_id,
                "product_name": row.product_name,
                "sku": row.sku,
                "code": row.code,
                "source": row.source,
                "created_at": row.created_at,
            }
            for row in query.limit(limit).all()
        ]

    def scan_count_today(self, tenant_id: UUID, warehouse_location: str | None = None) -> int:
        start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        query = self.db.query(func.count(ProductScanLog.id)).filter(
            ProductScanLog.tenant_id == tenant_id,
            ProductScanLog.created_at >= start,
        )
        if warehouse_location:
            query = query.join(Product, Product.id == ProductScanLog.product_id).filter(
                Product.warehouse_location == warehouse_location
            )
        return int(query.scalar() or 0)

    def warehouse_inventory_items(
        self,
        tenant_id: UUID,
        warehouse_location: str,
        limit: int = 12,
    ) -> list[dict]:
        rows = (
            self.db.query(Product)
            .filter(Product.tenant_id == tenant_id, Product.warehouse_location == warehouse_location)
            .order_by(Product.quantity.asc(), Product.product_name.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": product.id,
                "product_name": product.product_name,
                "sku": product.sku,
                "quantity": product.quantity,
                "warehouse_location": product.warehouse_location,
                "stock_status": "out_of_stock"
                if product.quantity <= 0
                else "low_stock"
                if product.quantity <= 10
                else "available",
            }
            for product in rows
        ]

    def todays_movements_by_warehouse(self, tenant_id: UUID, warehouse_location: str) -> dict[str, int]:
        start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        query = (
            self.db.query(
                func.count(InventoryTransaction.id),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                InventoryTransaction.transaction_type == "STOCK_IN",
                                InventoryTransaction.quantity,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                InventoryTransaction.transaction_type == "STOCK_OUT",
                                InventoryTransaction.quantity,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ),
            )
            .join(Product, Product.id == InventoryTransaction.product_id)
            .filter(
                InventoryTransaction.tenant_id == tenant_id,
                Product.warehouse_location == warehouse_location,
                InventoryTransaction.created_at >= start,
            )
        )
        count, stock_in, stock_out = query.one()
        return {
            "count": int(count or 0),
            "stock_in": int(stock_in or 0),
            "stock_out": int(stock_out or 0),
        }

    def pending_receipts_by_warehouse(self, tenant_id: UUID, warehouse_location: str) -> int:
        return int(
            self.db.query(func.count(func.distinct(PurchaseOrder.id)))
            .join(PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
            .join(Product, Product.id == PurchaseOrderItem.product_id)
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                Product.warehouse_location == warehouse_location,
                PurchaseOrder.status.in_(
                    [
                        PurchaseOrderStatus.APPROVED.value,
                        PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
                    ]
                ),
            )
            .scalar()
            or 0
        )

    def total_tenants(self) -> int:
        return int(self.db.query(func.count(Tenant.id)).scalar() or 0)

    def active_tenants(self) -> int:
        return int(
            self.db.query(func.count(Tenant.id))
            .filter(Tenant.status == TenantStatus.ACTIVE)
            .scalar()
            or 0
        )

    def total_users(self) -> int:
        return int(self.db.query(func.count(User.id)).scalar() or 0)

    def tenant_summaries(self) -> list[dict]:
        products = (
            self.db.query(
                Product.tenant_id.label("tenant_id"),
                func.count(Product.id).label("product_count"),
                func.coalesce(func.sum(Product.quantity), 0).label("inventory_units"),
            )
            .group_by(Product.tenant_id)
            .subquery()
        )
        users = (
            self.db.query(
                User.tenant_id.label("tenant_id"),
                func.count(User.id).label("active_users"),
            )
            .filter(User.is_active.is_(True))
            .group_by(User.tenant_id)
            .subquery()
        )
        activity = (
            self.db.query(
                InventoryTransaction.tenant_id.label("tenant_id"),
                func.max(InventoryTransaction.created_at).label("last_activity_at"),
            )
            .group_by(InventoryTransaction.tenant_id)
            .subquery()
        )
        rows = (
            self.db.query(
                Tenant.id,
                Tenant.company_name,
                Tenant.status,
                func.coalesce(products.c.product_count, 0),
                func.coalesce(products.c.inventory_units, 0),
                func.coalesce(users.c.active_users, 0),
                activity.c.last_activity_at,
            )
            .outerjoin(products, products.c.tenant_id == Tenant.id)
            .outerjoin(users, users.c.tenant_id == Tenant.id)
            .outerjoin(activity, activity.c.tenant_id == Tenant.id)
            .order_by(Tenant.company_name)
            .all()
        )
        return [
            {
                "tenant_id": row.id,
                "company_name": row.company_name,
                "status": row.status.value,
                "product_count": int(row[3] or 0),
                "inventory_units": int(row[4] or 0),
                "active_users": int(row[5] or 0),
                "last_activity_at": row.last_activity_at,
            }
            for row in rows
        ]

    def tenant_summary(self, tenant_id: UUID) -> dict | None:
        summaries = [
            summary for summary in self.tenant_summaries() if summary["tenant_id"] == tenant_id
        ]
        return summaries[0] if summaries else None

    def low_stock_tenant_count(self) -> int:
        return int(
            self.db.query(func.count(func.distinct(Product.tenant_id)))
            .filter(Product.quantity <= 10, Product.tenant_id.isnot(None))
            .scalar()
            or 0
        )

    def tenants_with_products(self) -> int:
        return int(
            self.db.query(func.count(func.distinct(Product.tenant_id)))
            .filter(Product.tenant_id.isnot(None))
            .scalar()
            or 0
        )

    def tenants_with_recent_activity(self, days: int = 30) -> int:
        cutoff = datetime.now(UTC) - timedelta(days=days)
        return int(
            self.db.query(func.count(func.distinct(InventoryTransaction.tenant_id)))
            .filter(
                InventoryTransaction.tenant_id.isnot(None),
                InventoryTransaction.created_at >= cutoff,
            )
            .scalar()
            or 0
        )

    def platform_usage(self) -> dict:
        total_tenants = max(1, self.total_tenants())
        total_products = self.total_products()
        return {
            "tenants_with_products": self.tenants_with_products(),
            "tenants_with_recent_activity": self.tenants_with_recent_activity(),
            "average_products_per_tenant": round(total_products / total_tenants, 2),
            "low_stock_tenant_count": self.low_stock_tenant_count(),
        }

    def recent_tenant_activity(self, limit: int = 8) -> list[dict]:
        activity = (
            self.db.query(
                InventoryTransaction.tenant_id.label("tenant_id"),
                func.count(InventoryTransaction.id).label("activity_count"),
                func.max(InventoryTransaction.created_at).label("last_activity_at"),
            )
            .filter(InventoryTransaction.tenant_id.isnot(None))
            .group_by(InventoryTransaction.tenant_id)
            .subquery()
        )
        rows = (
            self.db.query(
                Tenant.id,
                Tenant.company_name,
                Tenant.status,
                activity.c.activity_count,
                activity.c.last_activity_at,
            )
            .join(activity, activity.c.tenant_id == Tenant.id)
            .order_by(activity.c.last_activity_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "tenant_id": row.id,
                "company_name": row.company_name,
                "status": row.status.value,
                "activity_count": int(row.activity_count or 0),
                "last_activity_at": row.last_activity_at,
            }
            for row in rows
        ]

    def activity_trends(self, tenant_id: UUID, days: int = 14) -> list[dict]:
        cutoff = datetime.now(UTC) - timedelta(days=days)
        period = func.to_char(
            func.date_trunc("day", InventoryTransaction.created_at),
            "YYYY-MM-DD",
        )
        rows = (
            self.db.query(
                period.label("period"),
                func.count(InventoryTransaction.id).label("transaction_count"),
                func.coalesce(func.sum(func.abs(InventoryTransaction.quantity)), 0).label(
                    "units_moved"
                ),
            )
            .filter(
                InventoryTransaction.tenant_id == tenant_id,
                InventoryTransaction.created_at >= cutoff,
            )
            .group_by(period)
            .order_by(period)
            .all()
        )
        return [
            {
                "period": row.period,
                "transaction_count": int(row.transaction_count or 0),
                "units_moved": int(row.units_moved or 0),
            }
            for row in rows
        ]

    def transaction_volume(self, tenant_id: UUID) -> int:
        return int(
            self.db.query(func.count(InventoryTransaction.id))
            .filter(InventoryTransaction.tenant_id == tenant_id)
            .scalar()
            or 0
        )

    def suspicious_adjustments(self, tenant_id: UUID) -> int:
        return int(
            self.db.query(func.count(InventoryTransaction.id))
            .filter(
                InventoryTransaction.tenant_id == tenant_id,
                InventoryTransaction.transaction_type == "ADJUSTMENT",
                func.abs(InventoryTransaction.quantity) >= 50,
            )
            .scalar()
            or 0
        )

    def warehouse_activity_summary(self, tenant_id: UUID, limit: int = 8) -> list[dict]:
        warehouse = func.coalesce(Product.warehouse_location, "Unassigned")
        rows = (
            self.db.query(
                warehouse.label("warehouse_location"),
                func.count(InventoryTransaction.id).label("transaction_count"),
                func.coalesce(
                    func.sum(
                        case(
                            (InventoryTransaction.transaction_type == "STOCK_IN", InventoryTransaction.quantity),
                            else_=0,
                        )
                    ),
                    0,
                ).label("stock_in"),
                func.coalesce(
                    func.sum(
                        case(
                            (InventoryTransaction.transaction_type == "STOCK_OUT", InventoryTransaction.quantity),
                            else_=0,
                        )
                    ),
                    0,
                ).label("stock_out"),
                func.coalesce(
                    func.sum(
                        case(
                            (InventoryTransaction.transaction_type == "ADJUSTMENT", 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("adjustments"),
            )
            .join(Product, Product.id == InventoryTransaction.product_id)
            .filter(InventoryTransaction.tenant_id == tenant_id)
            .group_by(warehouse)
            .order_by(func.count(InventoryTransaction.id).desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "warehouse_location": row.warehouse_location,
                "transaction_count": int(row.transaction_count or 0),
                "stock_in": int(row.stock_in or 0),
                "stock_out": int(row.stock_out or 0),
                "adjustments": int(row.adjustments or 0),
            }
            for row in rows
        ]

    def most_active_users(self, tenant_id: UUID, limit: int = 8) -> list[dict]:
        rows = (
            self.db.query(
                InventoryTransaction.updated_by,
                func.coalesce(User.name, "System").label("user_name"),
                func.count(InventoryTransaction.id).label("activity_count"),
                func.max(InventoryTransaction.created_at).label("last_activity_at"),
            )
            .outerjoin(User, User.id == InventoryTransaction.updated_by)
            .filter(InventoryTransaction.tenant_id == tenant_id)
            .group_by(InventoryTransaction.updated_by, User.name)
            .order_by(func.count(InventoryTransaction.id).desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "user_id": row.updated_by,
                "user_name": row.user_name,
                "activity_count": int(row.activity_count or 0),
                "last_activity_at": row.last_activity_at,
            }
            for row in rows
        ]

    def suspicious_flags(self, tenant_id: UUID, limit: int = 8) -> list[dict]:
        rows = (
            self.db.query(
                InventoryTransaction.id,
                Product.product_name,
                InventoryTransaction.transaction_type,
                InventoryTransaction.quantity,
                InventoryTransaction.notes,
                InventoryTransaction.created_at,
            )
            .join(Product, Product.id == InventoryTransaction.product_id)
            .filter(
                InventoryTransaction.tenant_id == tenant_id,
                (
                    (InventoryTransaction.transaction_type == "ADJUSTMENT")
                    & (func.abs(InventoryTransaction.quantity) >= 50)
                )
                | (
                    (InventoryTransaction.transaction_type == "STOCK_OUT")
                    & (InventoryTransaction.quantity >= 100)
                ),
            )
            .order_by(InventoryTransaction.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": row.id,
                "product_name": row.product_name,
                "transaction_type": row.transaction_type,
                "quantity": row.quantity,
                "notes": row.notes,
                "created_at": row.created_at,
                "reason": "Large adjustment"
                if row.transaction_type == "ADJUSTMENT"
                else "High stock removal",
            }
            for row in rows
        ]

    def reorder_recommendations(self, tenant_id: UUID, limit: int = 8) -> list[dict]:
        rows = (
            self.db.query(Product)
            .filter(Product.tenant_id == tenant_id, Product.quantity <= 10)
            .order_by(Product.quantity.asc(), Product.product_name.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "product_id": product.id,
                "product_name": product.product_name,
                "sku": product.sku,
                "quantity": product.quantity,
                "recommended_quantity": max(25, 50 - product.quantity),
                "warehouse_location": product.warehouse_location,
            }
            for product in rows
        ]

    def incoming_shipments(self, tenant_id: UUID) -> int:
        return int(
            self.db.query(func.count(PurchaseOrder.id))
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status.in_(
                    [
                        PurchaseOrderStatus.APPROVED.value,
                        PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
                    ]
                ),
            )
            .scalar()
            or 0
        )

    def delayed_deliveries(self, tenant_id: UUID) -> int:
        today = datetime.now(UTC).date()
        return int(
            self.db.query(func.count(PurchaseOrder.id))
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.expected_delivery_date < today,
                PurchaseOrder.status.in_(
                    [
                        PurchaseOrderStatus.PENDING.value,
                        PurchaseOrderStatus.APPROVED.value,
                        PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
                    ]
                ),
            )
            .scalar()
            or 0
        )

    def monthly_purchasing_summary(self, tenant_id: UUID) -> dict:
        start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        total, units = (
            self.db.query(
                func.coalesce(func.sum(PurchaseOrderItem.unit_price * PurchaseOrderItem.quantity_ordered), 0),
                func.coalesce(func.sum(PurchaseOrderItem.quantity_received), 0),
            )
            .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
            .filter(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.created_at >= start)
            .one()
        )
        return {
            "purchase_total": round(float(total or 0), 2),
            "received_units": int(units or 0),
        }

    def recent_purchase_orders(self, tenant_id: UUID, limit: int = 6) -> list[dict]:
        rows = (
            self.db.query(PurchaseOrder, Supplier.name.label("supplier_name"))
            .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
            .filter(PurchaseOrder.tenant_id == tenant_id)
            .order_by(PurchaseOrder.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": order.id,
                "po_number": order.po_number,
                "supplier_name": supplier_name,
                "status": order.status,
                "expected_delivery_date": order.expected_delivery_date,
                "created_at": order.created_at,
            }
            for order, supplier_name in rows
        ]
