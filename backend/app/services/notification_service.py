from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.enums import PurchaseOrderStatus, UserRole
from app.models.inventory_transaction import InventoryTransaction
from app.models.notification import Notification
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderAuditLog
from app.models.tenant import Tenant
from app.models.user import User
from app.models.warehouse import StockTransfer


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_notifications(self, user: User, limit: int = 20, include_read: bool = False) -> list[Notification]:
        self._sync_notifications(user)
        query = self.db.query(Notification).filter(Notification.user_id == user.id)
        if not include_read:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.is_read.asc(), Notification.created_at.desc()).limit(limit).all()

    def unread_count(self, user: User) -> int:
        self._sync_notifications(user)
        return int(
            self.db.query(func.count(Notification.id))
            .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
            .scalar()
            or 0
        )

    def mark_read(self, user: User, notification_id: UUID | None = None) -> int:
        query = self.db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        if notification_id is not None:
            query = query.filter(Notification.id == notification_id)
        now = datetime.now(UTC)
        count = 0
        for notification in query.all():
            notification.is_read = True
            notification.read_at = now
            count += 1
        self.db.flush()
        return count

    def activity_feed(self, user: User, limit: int = 20) -> list[dict]:
        if user.role == UserRole.SUPER_ADMIN:
            return self._platform_activity(limit)
        if user.tenant_id is None:
            return []
        items = self._tenant_activity(user.tenant_id, limit)
        if user.role == UserRole.WAREHOUSE_STAFF and user.assigned_warehouse:
            items = [item for item in items if item.get("warehouse_location") in (None, user.assigned_warehouse)]
        if user.role == UserRole.WAREHOUSE_STAFF:
            items = [item for item in items if item["group"] in {"inventory", "warehouse"}]
        if user.role == UserRole.INVENTORY_MANAGER:
            items = [item for item in items if item["group"] in {"inventory", "warehouse"}]
        return sorted(items, key=lambda item: item["created_at"], reverse=True)[:limit]

    def _sync_notifications(self, user: User) -> None:
        for payload in self._notification_payloads(user):
            existing = (
                self.db.query(Notification)
                .filter(Notification.user_id == user.id, Notification.dedupe_key == payload["dedupe_key"])
                .one_or_none()
            )
            if existing is None:
                self.db.add(Notification(user_id=user.id, tenant_id=user.tenant_id, **payload))
        self.db.flush()

    def _notification_payloads(self, user: User) -> list[dict]:
        if user.role == UserRole.SUPER_ADMIN:
            active_tenants = int(self.db.query(func.count(Tenant.id)).scalar() or 0)
            recent_users = self.db.query(User).order_by(User.created_at.desc()).limit(3).all()
            return [
                {
                    "type": "platform_activity",
                    "group": "platform",
                    "title": "Platform activity summary",
                    "message": f"{active_tenants} tenants are present on the platform.",
                    "entity_type": None,
                    "entity_id": None,
                    "dedupe_key": f"platform-summary-{active_tenants}",
                },
                *[
                    {
                        "type": "new_user_added",
                        "group": "users",
                        "title": "New user added",
                        "message": f"{recent_user.name} joined as {recent_user.role.value.replace('_', ' ')}.",
                        "entity_type": "user",
                        "entity_id": recent_user.id,
                        "dedupe_key": f"user-created-{recent_user.id}",
                    }
                    for recent_user in recent_users
                ],
            ]

        if user.tenant_id is None:
            return []

        payloads: list[dict] = []
        low_stock = (
            self.db.query(Product)
            .filter(Product.tenant_id == user.tenant_id, Product.quantity <= 10)
            .order_by(Product.quantity.asc(), Product.product_name.asc())
            .limit(5)
            .all()
        )
        for product in low_stock:
            if user.role == UserRole.WAREHOUSE_STAFF and product.warehouse_location != user.assigned_warehouse:
                continue
            payloads.append(
                {
                    "type": "low_stock",
                    "group": "inventory",
                    "title": "Low stock alert",
                    "message": f"{product.product_name} has {product.quantity} units remaining.",
                    "entity_type": "product",
                    "entity_id": product.id,
                    "dedupe_key": f"low-stock-{product.id}-{product.quantity}",
                }
            )

        for tx in self._recent_transactions(user):
            payloads.append(
                {
                    "type": "stock_adjustment" if tx.transaction_type == "ADJUSTMENT" else "inventory_movement",
                    "group": "inventory",
                    "title": tx.transaction_type.replace("_", " ").title(),
                    "message": f"{tx.product.product_name}: {tx.quantity} units.",
                    "entity_type": "inventory_transaction",
                    "entity_id": tx.id,
                    "dedupe_key": f"inventory-tx-{tx.id}",
                }
            )

        if user.role in {UserRole.RETAILER_ADMIN, UserRole.PROCUREMENT_MANAGER}:
            payloads.extend(self._purchase_order_notifications(user.tenant_id))
        if user.role in {UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF}:
            payloads.extend(self._warehouse_notifications(user.tenant_id, user.assigned_warehouse if user.role == UserRole.WAREHOUSE_STAFF else None))
        if user.role == UserRole.RETAILER_ADMIN:
            payloads.extend(self._new_user_notifications(user.tenant_id))
        return payloads

    def _recent_transactions(self, user: User) -> list[InventoryTransaction]:
        query = (
            self.db.query(InventoryTransaction)
            .join(Product, Product.id == InventoryTransaction.product_id)
            .filter(InventoryTransaction.tenant_id == user.tenant_id)
            .order_by(InventoryTransaction.created_at.desc())
            .limit(5)
        )
        if user.role == UserRole.WAREHOUSE_STAFF:
            query = query.filter(Product.warehouse_location == user.assigned_warehouse)
        return query.all()

    def _purchase_order_notifications(self, tenant_id: UUID) -> list[dict]:
        cutoff = datetime.now(UTC).date()
        orders = (
            self.db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status.in_([PurchaseOrderStatus.APPROVED.value, PurchaseOrderStatus.PENDING.value]),
            )
            .order_by(PurchaseOrder.updated_at.desc())
            .limit(5)
            .all()
        )
        payloads = []
        for order in orders:
            delayed = order.expected_delivery_date is not None and order.expected_delivery_date < cutoff and order.status == PurchaseOrderStatus.APPROVED.value
            payloads.append(
                {
                    "type": "shipment_delayed" if delayed else "po_approved" if order.status == PurchaseOrderStatus.APPROVED.value else "po_pending",
                    "group": "procurement",
                    "title": "Shipment delayed" if delayed else "Purchase order approved" if order.status == PurchaseOrderStatus.APPROVED.value else "Purchase order pending",
                    "message": f"{order.po_number} is {order.status.replace('_', ' ')}.",
                    "entity_type": "purchase_order",
                    "entity_id": order.id,
                    "dedupe_key": f"po-{order.status}-{order.id}",
                }
            )
        return payloads

    def _warehouse_notifications(self, tenant_id: UUID, assigned_warehouse: str | None = None) -> list[dict]:
        query = self.db.query(StockTransfer).filter(StockTransfer.tenant_id == tenant_id).order_by(StockTransfer.updated_at.desc()).limit(5)
        transfers = query.all()
        payloads = []
        for transfer in transfers:
            if assigned_warehouse and transfer.destination_warehouse.name != assigned_warehouse and transfer.source_warehouse.name != assigned_warehouse:
                continue
            payloads.append(
                {
                    "type": "transfer_approved" if transfer.status == "approved" else "transfer_pending",
                    "group": "warehouse",
                    "title": "Transfer approved" if transfer.status == "approved" else "Warehouse transfer update",
                    "message": f"{transfer.quantity} units of {transfer.product.product_name}: {transfer.status}.",
                    "entity_type": "stock_transfer",
                    "entity_id": transfer.id,
                    "dedupe_key": f"transfer-{transfer.status}-{transfer.id}",
                }
            )
        return payloads

    def _new_user_notifications(self, tenant_id: UUID) -> list[dict]:
        return [
            {
                "type": "new_user_added",
                "group": "users",
                "title": "New user added",
                "message": f"{user.name} joined as {user.role.value.replace('_', ' ')}.",
                "entity_type": "user",
                "entity_id": user.id,
                "dedupe_key": f"tenant-user-{user.id}",
            }
            for user in self.db.query(User).filter(User.tenant_id == tenant_id).order_by(User.created_at.desc()).limit(3).all()
        ]

    def _tenant_activity(self, tenant_id: UUID, limit: int) -> list[dict]:
        items: list[dict] = []
        transactions = (
            self.db.query(InventoryTransaction)
            .join(Product, Product.id == InventoryTransaction.product_id)
            .filter(InventoryTransaction.tenant_id == tenant_id)
            .order_by(InventoryTransaction.created_at.desc())
            .limit(limit)
            .all()
        )
        for tx in transactions:
            items.append({
                "id": f"tx-{tx.id}",
                "type": tx.transaction_type.lower(),
                "group": "inventory",
                "title": tx.transaction_type.replace("_", " ").title(),
                "message": f"{tx.product.product_name}: {tx.quantity} units.",
                "created_at": tx.created_at,
                "warehouse_location": tx.product.warehouse_location,
            })
        for log in (
            self.db.query(PurchaseOrderAuditLog)
            .filter(PurchaseOrderAuditLog.tenant_id == tenant_id)
            .order_by(PurchaseOrderAuditLog.created_at.desc())
            .limit(limit)
            .all()
        ):
            items.append({
                "id": f"po-log-{log.id}",
                "type": f"po_{log.action}",
                "group": "procurement",
                "title": f"PO {log.action}",
                "message": log.details or "Purchase order activity recorded.",
                "created_at": log.created_at,
                "warehouse_location": None,
            })
        return items

    def _platform_activity(self, limit: int) -> list[dict]:
        return [
            {
                "id": f"user-{user.id}",
                "type": "new_user_added",
                "group": "platform",
                "title": "User activity",
                "message": f"{user.name} joined {user.tenant.company_name if user.tenant else 'platform'} as {user.role.value.replace('_', ' ')}.",
                "created_at": user.created_at,
            }
            for user in self.db.query(User).order_by(User.created_at.desc()).limit(limit).all()
        ]
