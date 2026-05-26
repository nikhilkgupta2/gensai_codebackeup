from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
import sys
from pathlib import Path

from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401
from app.core.enums import PurchaseOrderAuditAction, PurchaseOrderStatus, SupplierStatus, UserRole
from app.db.session import SessionLocal
from app.models.inventory_transaction import InventoryTransaction
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderAuditLog, PurchaseOrderItem
from app.models.supplier import Supplier
from app.models.tenant import Tenant
from app.models.user import User

SEED_TENANT_EMAIL = "admin@acmeretail.io"
SEED_MARKER = "development procurement seed"

SUPPLIERS = [
    (
        "Northstar Wholesale",
        "Anika Rao",
        "orders@northstarwholesale.example",
        "+1 555 0101",
        "200 Harbor Road, Austin, TX",
    ),
    (
        "Metro Goods Supply",
        "Ethan Lee",
        "procurement@metrogoods.example",
        "+1 555 0102",
        "44 Market Street, Dallas, TX",
    ),
    (
        "Summit Office Works",
        "Priya Menon",
        "sales@summitoffice.example",
        "+1 555 0103",
        "90 Commerce Park, Denver, CO",
    ),
    (
        "BlueLine Electronics",
        "Marcus Chen",
        "accounts@blueline.example",
        "+1 555 0104",
        "18 Circuit Avenue, San Jose, CA",
    ),
    (
        "Evergreen Packaging",
        "Sofia Patel",
        "supply@evergreenpack.example",
        "+1 555 0105",
        "700 Pine Lane, Portland, OR",
    ),
    (
        "Urban Retail Source",
        "Noah Williams",
        "orders@urbanretail.example",
        "+1 555 0106",
        "12 Union Square, Chicago, IL",
    ),
    (
        "Prime Warehouse Co.",
        "Maya Thompson",
        "team@primewarehouse.example",
        "+1 555 0107",
        "345 Logistics Way, Phoenix, AZ",
    ),
    (
        "Vertex Furnishings",
        "Owen Garcia",
        "sales@vertexfurnish.example",
        "+1 555 0108",
        "88 Cedar Drive, Raleigh, NC",
    ),
    (
        "Atlas Accessories",
        "Leah Brooks",
        "hello@atlasaccessories.example",
        "+1 555 0109",
        "6 Meridian Plaza, Seattle, WA",
    ),
    (
        "Cobalt Audio Supply",
        "Daniel Singh",
        "orders@cobaltaudio.example",
        "+1 555 0110",
        "510 Studio Boulevard, Nashville, TN",
    ),
    (
        "Pioneer Retail Partners",
        "Grace Kim",
        "ops@pioneerretail.example",
        "+1 555 0111",
        "19 Foundry Street, Boston, MA",
    ),
    (
        "Horizon Tech Depot",
        "Ravi Kapoor",
        "buying@horizontech.example",
        "+1 555 0112",
        "77 Innovation Loop, Atlanta, GA",
    ),
]

PRODUCTS = [
    {
        "product_name": "Acme Wireless Keyboard",
        "sku": "ACME-KB-001",
        "category": "Electronics",
        "brand": "Acme",
        "quantity": 120,
        "price": Decimal("49.99"),
        "supplier": "Northstar Wholesale",
        "warehouse_location": "Warehouse A",
        "description": "Slim wireless keyboard for office and home use.",
    },
    {
        "product_name": "Acme Ergonomic Mouse",
        "sku": "ACME-MS-002",
        "category": "Electronics",
        "brand": "Acme",
        "quantity": 85,
        "price": Decimal("29.95"),
        "supplier": "Metro Goods Supply",
        "warehouse_location": "Warehouse A",
        "description": "Comfort-fit mouse with programmable buttons.",
    },
    {
        "product_name": "Acme Office Chair",
        "sku": "ACME-CH-003",
        "category": "Furniture",
        "brand": "Acme",
        "quantity": 34,
        "price": Decimal("159.99"),
        "supplier": "Vertex Furnishings",
        "warehouse_location": "Warehouse B",
        "description": "Adjustable ergonomic office chair with lumbar support.",
    },
    {
        "product_name": "Acme USB-C Hub",
        "sku": "ACME-HB-004",
        "category": "Accessories",
        "brand": "Acme",
        "quantity": 200,
        "price": Decimal("24.50"),
        "supplier": "Atlas Accessories",
        "warehouse_location": "Warehouse C",
        "description": "6-port USB-C hub with HDMI and Ethernet.",
    },
    {
        "product_name": "Acme Wireless Headset",
        "sku": "ACME-HS-005",
        "category": "Electronics",
        "brand": "Acme",
        "quantity": 58,
        "price": Decimal("79.99"),
        "supplier": "Cobalt Audio Supply",
        "warehouse_location": "Warehouse B",
        "description": "Noise-cancelling headset with long battery life.",
    },
    {
        "product_name": "Acme Barcode Scanner",
        "sku": "ACME-SC-006",
        "category": "Operations",
        "brand": "Acme",
        "quantity": 42,
        "price": Decimal("119.00"),
        "supplier": "BlueLine Electronics",
        "warehouse_location": "Warehouse A",
        "description": "Handheld scanner for receiving and cycle counts.",
    },
    {
        "product_name": "Acme Thermal Label Roll",
        "sku": "ACME-LB-007",
        "category": "Packaging",
        "brand": "Acme",
        "quantity": 520,
        "price": Decimal("12.75"),
        "supplier": "Evergreen Packaging",
        "warehouse_location": "Warehouse C",
        "description": "Thermal labels for product and shelf tagging.",
    },
    {
        "product_name": "Acme Packing Tape",
        "sku": "ACME-PT-008",
        "category": "Packaging",
        "brand": "Acme",
        "quantity": 310,
        "price": Decimal("6.40"),
        "supplier": "Prime Warehouse Co.",
        "warehouse_location": "Warehouse C",
        "description": "Heavy-duty tape for fulfillment operations.",
    },
]

STATUS_SEQUENCE = [
    PurchaseOrderStatus.DRAFT,
    PurchaseOrderStatus.PENDING,
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.PARTIALLY_RECEIVED,
    PurchaseOrderStatus.COMPLETED,
    PurchaseOrderStatus.CANCELLED,
    PurchaseOrderStatus.PENDING,
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.COMPLETED,
    PurchaseOrderStatus.PARTIALLY_RECEIVED,
]


def get_seed_tenant(db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.contact_email == SEED_TENANT_EMAIL).one_or_none()
    if tenant is None:
        tenant = Tenant(company_name="Acme Retail Co.", contact_email=SEED_TENANT_EMAIL)
        db.add(tenant)
        db.flush()
    return tenant


def get_seed_actor(db: Session, tenant: Tenant) -> User | None:
    return (
        db.query(User)
        .filter(User.tenant_id == tenant.id, User.role == UserRole.RETAILER_ADMIN)
        .order_by(User.created_at.asc())
        .first()
    )


def upsert_products(db: Session, tenant: Tenant) -> list[Product]:
    products: list[Product] = []
    for data in PRODUCTS:
        product = db.query(Product).filter(Product.sku == data["sku"]).one_or_none()
        if product is None:
            product = Product(tenant_id=tenant.id, **data)
            db.add(product)
        else:
            product.tenant_id = tenant.id
            for key, value in data.items():
                setattr(product, key, value)
        products.append(product)
    db.flush()
    return products


def reset_seed_purchase_orders(db: Session, tenant: Tenant) -> None:
    seed_orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.tenant_id == tenant.id, PurchaseOrder.po_number.like("PO-SEED-%"))
        .all()
    )
    for order in seed_orders:
        db.delete(order)
    db.flush()


def upsert_suppliers(db: Session, tenant: Tenant) -> list[Supplier]:
    suppliers: list[Supplier] = []
    for index, (name, contact_name, email, phone, address) in enumerate(SUPPLIERS):
        supplier = (
            db.query(Supplier)
            .filter(Supplier.tenant_id == tenant.id, Supplier.name == name)
            .one_or_none()
        )
        if supplier is None:
            supplier = Supplier(tenant_id=tenant.id, name=name)
            db.add(supplier)
        supplier.contact_name = contact_name
        supplier.contact_email = email
        supplier.contact_phone = phone
        supplier.address = address
        supplier.status = (
            SupplierStatus.INACTIVE.value
            if index == len(SUPPLIERS) - 1
            else SupplierStatus.ACTIVE.value
        )
        supplier.notes = SEED_MARKER
        suppliers.append(supplier)
    db.flush()
    return suppliers


def add_audit(
    db: Session,
    order: PurchaseOrder,
    actor: User | None,
    action: PurchaseOrderAuditAction,
    details: str,
) -> None:
    db.add(
        PurchaseOrderAuditLog(
            tenant_id=order.tenant_id,
            purchase_order_id=order.id,
            actor_id=actor.id if actor else None,
            action=action.value,
            details=details,
        )
    )


def seed_purchase_orders(
    db: Session,
    *,
    tenant: Tenant,
    suppliers: list[Supplier],
    products: list[Product],
    actor: User | None,
) -> None:
    today = date.today()
    active_suppliers = [
        supplier for supplier in suppliers if supplier.status == SupplierStatus.ACTIVE.value
    ]
    for index in range(20):
        status = STATUS_SEQUENCE[index % len(STATUS_SEQUENCE)]
        supplier = active_suppliers[index % len(active_suppliers)]
        order = PurchaseOrder(
            tenant_id=tenant.id,
            supplier_id=supplier.id,
            po_number=f"PO-SEED-{index + 1:04d}",
            status=status.value,
            expected_delivery_date=today + timedelta(days=(index % 9) - 3),
            notes=f"{SEED_MARKER}: replenishment cycle {index + 1}",
            created_by=actor.id if actor else None,
        )
        if status in {
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.COMPLETED,
        }:
            order.approved_by = actor.id if actor else None
            order.approved_at = datetime.now(UTC) - timedelta(days=max(1, index % 6))

        line_count = 2 if index % 3 else 3
        for line_index in range(line_count):
            product = products[(index + line_index) % len(products)]
            quantity_ordered = 8 + ((index + line_index) % 5) * 6
            quantity_received = 0
            if status == PurchaseOrderStatus.COMPLETED:
                quantity_received = quantity_ordered
            elif status == PurchaseOrderStatus.PARTIALLY_RECEIVED:
                quantity_received = max(1, quantity_ordered // 2)

            order.items.append(
                PurchaseOrderItem(
                    product_id=product.id,
                    quantity_ordered=quantity_ordered,
                    quantity_received=quantity_received,
                    unit_price=Decimal(str(product.price or 0)),
                )
            )
            if quantity_received:
                db.add(
                    InventoryTransaction(
                        tenant_id=tenant.id,
                        product_id=product.id,
                        transaction_type="STOCK_IN",
                        quantity=quantity_received,
                        updated_by=actor.id if actor else None,
                        notes=f"Received against {order.po_number}",
                    )
                )

        db.add(order)
        db.flush()
        add_audit(
            db, order, actor, PurchaseOrderAuditAction.CREATED, "Development seed order created."
        )
        if status in {
            PurchaseOrderStatus.PENDING,
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.COMPLETED,
        }:
            add_audit(
                db,
                order,
                actor,
                PurchaseOrderAuditAction.SUBMITTED,
                "Development seed order submitted.",
            )
        if status in {
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.COMPLETED,
        }:
            add_audit(
                db,
                order,
                actor,
                PurchaseOrderAuditAction.APPROVED,
                "Development seed order approved.",
            )
        if status in {PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.COMPLETED}:
            add_audit(
                db,
                order,
                actor,
                PurchaseOrderAuditAction.RECEIVED,
                "Development seed receiving recorded.",
            )
        if status == PurchaseOrderStatus.CANCELLED:
            add_audit(
                db,
                order,
                actor,
                PurchaseOrderAuditAction.CANCELLED,
                "Development seed order cancelled.",
            )


def main() -> None:
    db = SessionLocal()
    try:
        tenant = get_seed_tenant(db)
        actor = get_seed_actor(db, tenant)
        products = upsert_products(db, tenant)
        reset_seed_purchase_orders(db, tenant)
        suppliers = upsert_suppliers(db, tenant)
        seed_purchase_orders(db, tenant=tenant, suppliers=suppliers, products=products, actor=actor)
        db.commit()
    finally:
        db.close()

    print("Seeded procurement demo data.")
    print("Suppliers: 12")
    print("Purchase orders: 20")
    print("Tenant: Acme Retail Co.")
    print("Retailer Admin: admin@acmeretail.io / Password123!")
    print("Inventory Manager: manager@acmeretail.io / Password123!")


if __name__ == "__main__":
    main()
