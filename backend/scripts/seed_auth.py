import sys
from pathlib import Path

from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.enums import UserRole
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.tenant import Tenant
from app.models.user import User

SEED_PASSWORD = "Password123!"
SEED_TENANT_EMAIL = "admin@acmeretail.io"

SEED_USERS = [
    {
        "name": "Retailer Admin",
        "email": "admin@acmeretail.io",
        "role": UserRole.RETAILER_ADMIN,
        "tenant_scoped": True,
    },
    {
        "name": "Inventory Manager",
        "email": "manager@acmeretail.io",
        "role": UserRole.INVENTORY_MANAGER,
        "tenant_scoped": True,
    },
    {
        "name": "Warehouse Staff",
        "email": "warehouse@acmeretail.io",
        "role": UserRole.WAREHOUSE_STAFF,
        "tenant_scoped": True,
        "assigned_warehouse": "Warehouse A",
    },
    {
        "name": "Auditor",
        "email": "auditor@acmeretail.io",
        "role": UserRole.AUDITOR,
        "tenant_scoped": True,
    },
    {
        "name": "Procurement Manager",
        "email": "procurement@acmeretail.io",
        "role": UserRole.PROCUREMENT_MANAGER,
        "tenant_scoped": True,
    },
    {
        "name": "Super Admin",
        "email": "super@inventorypro.io",
        "role": UserRole.SUPER_ADMIN,
        "tenant_scoped": False,
    },
]


def get_or_create_tenant(db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.contact_email == SEED_TENANT_EMAIL).one_or_none()
    if tenant:
        tenant.company_name = "Acme Retail Co."
        return tenant

    tenant = Tenant(company_name="Acme Retail Co.", contact_email=SEED_TENANT_EMAIL)
    db.add(tenant)
    db.flush()
    return tenant


def upsert_user(db: Session, *, tenant: Tenant, user_data: dict[str, object]) -> None:
    email = str(user_data["email"])
    user = db.query(User).filter(User.email == email).one_or_none()
    tenant_id = tenant.id if user_data["tenant_scoped"] else None

    if user is None:
        user = User(email=email, password_hash=hash_password(SEED_PASSWORD))
        db.add(user)

    user.name = str(user_data["name"])
    user.role = user_data["role"]
    user.tenant_id = tenant_id
    user.is_active = True
    user.assigned_warehouse = user_data.get("assigned_warehouse")
    user.password_hash = hash_password(SEED_PASSWORD)


def main() -> None:
    db = SessionLocal()
    try:
        tenant = get_or_create_tenant(db)
        for user_data in SEED_USERS:
            upsert_user(db, tenant=tenant, user_data=user_data)
        db.commit()
    finally:
        db.close()

    print("Seed data ready.")
    print(f"Retailer Admin: admin@acmeretail.io / {SEED_PASSWORD}")
    print(f"Inventory Manager: manager@acmeretail.io / {SEED_PASSWORD}")
    print(f"Warehouse Staff: warehouse@acmeretail.io / {SEED_PASSWORD}")
    print(f"Auditor: auditor@acmeretail.io / {SEED_PASSWORD}")
    print(f"Procurement Manager: procurement@acmeretail.io / {SEED_PASSWORD}")
    print(f"Super Admin: super@inventorypro.io / {SEED_PASSWORD}")


if __name__ == "__main__":
    main()
