from datetime import UTC, datetime, timedelta
import sys
from pathlib import Path

from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401
from app.core.enums import UserRole
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog, StockAdjustmentRequest
from app.models.product import Product
from app.models.tenant import Tenant
from app.models.user import User

SEED_TENANT_EMAIL = "admin@acmeretail.io"
SEED_MARKER = "development audit seed"


def get_tenant(db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.contact_email == SEED_TENANT_EMAIL).one_or_none()
    if tenant is None:
        tenant = Tenant(company_name="Acme Retail Co.", contact_email=SEED_TENANT_EMAIL)
        db.add(tenant)
        db.flush()
    return tenant


def get_actor(db: Session, tenant: Tenant, role: UserRole) -> User | None:
    return (
        db.query(User)
        .filter(User.tenant_id == tenant.id, User.role == role)
        .order_by(User.created_at.asc())
        .first()
    )


def get_products(db: Session, tenant: Tenant) -> list[Product]:
    return (
        db.query(Product)
        .filter(Product.tenant_id == tenant.id)
        .order_by(Product.created_at.asc())
        .limit(8)
        .all()
    )


def clear_existing_seed(db: Session, tenant: Tenant) -> None:
    db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant.id,
        AuditLog.message.ilike(f"%{SEED_MARKER}%"),
    ).delete(synchronize_session=False)
    db.query(StockAdjustmentRequest).filter(
        StockAdjustmentRequest.tenant_id == tenant.id,
        StockAdjustmentRequest.notes.ilike(f"%{SEED_MARKER}%"),
    ).delete(synchronize_session=False)
    db.flush()


def add_log(
    db: Session,
    *,
    tenant: Tenant,
    actor: User | None,
    module: str,
    action: str,
    entity_type: str,
    entity_id,
    old_value: dict | None,
    new_value: dict | None,
    message: str,
    created_at: datetime,
) -> None:
    db.add(
        AuditLog(
            tenant_id=tenant.id,
            actor_id=actor.id if actor else None,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            message=f"{message} ({SEED_MARKER})",
            created_at=created_at,
            updated_at=created_at,
        )
    )


def seed_audit_logs(db: Session, tenant: Tenant, products: list[Product]) -> None:
    now = datetime.now(UTC)
    admin = get_actor(db, tenant, UserRole.RETAILER_ADMIN)
    manager = get_actor(db, tenant, UserRole.INVENTORY_MANAGER)
    warehouse = get_actor(db, tenant, UserRole.WAREHOUSE_STAFF)
    procurement = get_actor(db, tenant, UserRole.PROCUREMENT_MANAGER) or admin

    if not products:
        return

    events = [
        {
            "actor": manager,
            "module": "inventory",
            "action": "stock_in",
            "product": products[0],
            "old": 112,
            "new": 120,
            "message": "Stock received from daily replenishment",
            "hours_ago": 1,
        },
        {
            "actor": warehouse,
            "module": "inventory",
            "action": "stock_out",
            "product": products[1 % len(products)],
            "old": 91,
            "new": 85,
            "message": "Stock dispatched for customer orders",
            "hours_ago": 3,
        },
        {
            "actor": manager,
            "module": "inventory",
            "action": "approval_requested",
            "product": products[2 % len(products)],
            "old": 34,
            "new": 39,
            "message": "Cycle count adjustment submitted for approval",
            "hours_ago": 5,
        },
        {
            "actor": admin,
            "module": "inventory",
            "action": "approved",
            "product": products[2 % len(products)],
            "old": 34,
            "new": 39,
            "message": "Cycle count adjustment approved",
            "hours_ago": 4,
        },
        {
            "actor": warehouse,
            "module": "warehouse",
            "action": "transfer_requested",
            "product": products[3 % len(products)],
            "old": 200,
            "new": 180,
            "message": "Warehouse transfer requested from Warehouse A to Warehouse B",
            "hours_ago": 8,
        },
        {
            "actor": admin,
            "module": "warehouse",
            "action": "transfer_approved",
            "product": products[3 % len(products)],
            "old": 200,
            "new": 180,
            "message": "Warehouse transfer approved",
            "hours_ago": 7,
        },
        {
            "actor": procurement,
            "module": "procurement",
            "action": "approved",
            "product": products[4 % len(products)],
            "old": None,
            "new": None,
            "message": "Purchase order PO-SEED-0008 approved",
            "hours_ago": 11,
        },
        {
            "actor": warehouse,
            "module": "inventory",
            "action": "scan",
            "product": products[5 % len(products)],
            "old": None,
            "new": None,
            "message": "Barcode scan recorded at receiving station",
            "hours_ago": 14,
        },
        {
            "actor": admin,
            "module": "products",
            "action": "updated",
            "product": products[0],
            "old": None,
            "new": None,
            "message": "Product reorder threshold reviewed",
            "hours_ago": 20,
        },
        {
            "actor": admin,
            "module": "users",
            "action": "created",
            "product": products[0],
            "old": None,
            "new": None,
            "message": "Warehouse staff account added",
            "hours_ago": 28,
        },
    ]

    for event in events:
        product = event["product"]
        old_quantity = event["old"]
        new_quantity = event["new"]
        old_value = {"quantity": old_quantity} if old_quantity is not None else None
        new_value = {"quantity": new_quantity} if new_quantity is not None else None
        if new_value is not None:
            new_value.update({"product_name": product.product_name, "sku": product.sku})
        add_log(
            db,
            tenant=tenant,
            actor=event["actor"],
            module=event["module"],
            action=event["action"],
            entity_type="product" if event["module"] != "users" else "user",
            entity_id=product.id if event["module"] != "users" else (warehouse.id if warehouse else None),
            old_value=old_value,
            new_value=new_value,
            message=event["message"],
            created_at=now - timedelta(hours=event["hours_ago"]),
        )


def seed_approval_requests(db: Session, tenant: Tenant, products: list[Product]) -> None:
    manager = get_actor(db, tenant, UserRole.INVENTORY_MANAGER)
    admin = get_actor(db, tenant, UserRole.RETAILER_ADMIN)
    now = datetime.now(UTC)

    if not products:
        return

    pending_product = products[0]
    approved_product = products[1 % len(products)]

    pending = StockAdjustmentRequest(
        tenant_id=tenant.id,
        product_id=pending_product.id,
        quantity=6,
        notes=f"Cycle count variance for shelf A-04 ({SEED_MARKER})",
        status="pending",
        requested_by=manager.id if manager else None,
        created_at=now - timedelta(minutes=45),
        updated_at=now - timedelta(minutes=45),
    )
    approved = StockAdjustmentRequest(
        tenant_id=tenant.id,
        product_id=approved_product.id,
        quantity=-3,
        notes=f"Damaged items removed after inspection ({SEED_MARKER})",
        status="approved",
        requested_by=manager.id if manager else None,
        approved_by=admin.id if admin else None,
        created_at=now - timedelta(hours=6),
        updated_at=now - timedelta(hours=5, minutes=30),
    )
    db.add_all([pending, approved])


def main() -> None:
    db = SessionLocal()
    try:
        tenant = get_tenant(db)
        products = get_products(db, tenant)
        clear_existing_seed(db, tenant)
        seed_audit_logs(db, tenant, products)
        seed_approval_requests(db, tenant, products)
        db.commit()
    finally:
        db.close()

    print("Seeded audit timeline demo data.")
    print("Audit log events: 10")
    print("Stock adjustment approvals: 2")
    print("Tenant: Acme Retail Co.")
    print("Auditor: auditor@acmeretail.io / Password123!")
    print("Retailer Admin: admin@acmeretail.io / Password123!")


if __name__ == "__main__":
    main()
