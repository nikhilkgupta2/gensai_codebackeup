import sys
from pathlib import Path
from typing import Any
import os
import random

from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401
from app.db.session import SessionLocal
from app.models.product import Product
from app.models.tenant import Tenant

SEED_TENANT_EMAIL = "admin@acmeretail.io"
SEED_PREFIX = "SEED-PRD-"
DEFAULT_PRODUCT_COUNT = 100

SAMPLE_PRODUCTS = [
    {
        "product_name": "Acme Wireless Keyboard",
        "sku": "ACME-KB-001",
        "category": "Electronics",
        "brand": "Acme",
        "quantity": 120,
        "price": 49.99,
        "supplier": "Acme Distributors",
        "warehouse_location": "Warehouse A",
        "description": "Slim wireless keyboard for office and home use.",
    },
    {
        "product_name": "Acme Ergonomic Mouse",
        "sku": "ACME-MS-002",
        "category": "Electronics",
        "brand": "Acme",
        "quantity": 85,
        "price": 29.95,
        "supplier": "Acme Distributors",
        "warehouse_location": "Warehouse A",
        "description": "Comfort-fit mouse with programmable buttons.",
    },
    {
        "product_name": "Acme Office Chair",
        "sku": "ACME-CH-003",
        "category": "Furniture",
        "brand": "Acme",
        "quantity": 34,
        "price": 159.99,
        "supplier": "Acme Furnishings",
        "warehouse_location": "Warehouse B",
        "description": "Adjustable ergonomic office chair with lumbar support.",
    },
    {
        "product_name": "Acme USB-C Hub",
        "sku": "ACME-HB-004",
        "category": "Accessories",
        "brand": "Acme",
        "quantity": 200,
        "price": 24.5,
        "supplier": "Acme Distributors",
        "warehouse_location": "Warehouse C",
        "description": "6-port USB-C hub with HDMI and Ethernet.",
    },
    {
        "product_name": "Acme Wireless Headset",
        "sku": "ACME-HS-005",
        "category": "Electronics",
        "brand": "Acme",
        "quantity": 58,
        "price": 79.99,
        "supplier": "Acme Audio",
        "warehouse_location": "Warehouse B",
        "description": "Noise-cancelling headset with long battery life.",
    },
]

PRODUCT_CATEGORIES = [
    "Electronics",
    "Accessories",
    "Furniture",
    "Packaging",
    "Office Supplies",
    "Operations",
]

PRODUCT_BRANDS = ["Acme", "Nimbus", "Vertex", "Cobalt", "Evergreen", "Northstar", "Metro"]

WAREHOUSES = ["Warehouse A", "Warehouse B", "Warehouse C"]

SUPPLIERS = [
    "Northstar Wholesale",
    "Metro Goods Supply",
    "Summit Office Works",
    "BlueLine Electronics",
    "Evergreen Packaging",
    "Urban Retail Source",
    "Prime Warehouse Co.",
    "Vertex Furnishings",
    "Atlas Accessories",
    "Cobalt Audio Supply",
]


def build_generated_products(*, count: int) -> list[dict[str, Any]]:
    rng = random.Random(42)
    products: list[dict[str, Any]] = []
    for index in range(1, count + 1):
        category = rng.choice(PRODUCT_CATEGORIES)
        brand = rng.choice(PRODUCT_BRANDS)
        supplier = rng.choice(SUPPLIERS)
        warehouse = rng.choice(WAREHOUSES)
        sku = f"{SEED_PREFIX}{index:04d}"
        base_name = rng.choice(
            [
                "Wireless Mouse",
                "Keyboard",
                "USB-C Cable",
                "HDMI Adapter",
                "Label Roll",
                "Packing Tape",
                "Office Chair",
                "Standing Desk Converter",
                "Barcode Scanner",
                "Thermal Printer",
                "Laptop Stand",
                "Headset",
                "Webcam",
                "Docking Station",
                "Storage Bin",
                "Shelf Label Holder",
                "Hand Truck",
                "Packing Slip Pouch",
            ]
        )
        product_name = f"{brand} {base_name} {index:03d}"
        quantity = rng.randint(0, 600)
        price = round(rng.uniform(4.5, 399.0), 2)
        products.append(
            {
                "product_name": product_name,
                "sku": sku,
                "category": category,
                "brand": brand,
                "quantity": quantity,
                "price": price,
                "supplier": supplier,
                "warehouse_location": warehouse,
                "description": f"{base_name} for {category.lower()} workflows.",
            }
        )
    return products


def get_or_create_tenant(db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.contact_email == SEED_TENANT_EMAIL).one_or_none()
    if tenant:
        return tenant

    tenant = Tenant(company_name="Acme Retail Co.", contact_email=SEED_TENANT_EMAIL)
    db.add(tenant)
    db.flush()
    return tenant


def upsert_product(db: Session, tenant_id: Any, product_data: dict[str, Any]) -> None:
    sku = product_data["sku"]
    product = db.query(Product).filter(Product.sku == sku).one_or_none()
    if product is None:
        product = Product(tenant_id=tenant_id, **product_data)
        db.add(product)
    else:
        for key, value in product_data.items():
            setattr(product, key, value)


def main() -> None:
    product_count = int(os.getenv("SEED_PRODUCT_COUNT", str(DEFAULT_PRODUCT_COUNT)))
    if product_count < len(SAMPLE_PRODUCTS):
        product_count = len(SAMPLE_PRODUCTS)

    generated_products = build_generated_products(count=product_count - len(SAMPLE_PRODUCTS))
    seed_products = [*SAMPLE_PRODUCTS, *generated_products]

    db = SessionLocal()
    try:
        tenant = get_or_create_tenant(db)
        for product_data in seed_products:
            upsert_product(db, tenant_id=tenant.id, product_data=product_data)
        db.commit()
    finally:
        db.close()

    print("Seeded products into the database.")
    print(f"Tenant: Acme Retail Co. ({SEED_TENANT_EMAIL})")
    print(f"Products upserted: {len(seed_products)} (set SEED_PRODUCT_COUNT to change)")


if __name__ == "__main__":
    main()
