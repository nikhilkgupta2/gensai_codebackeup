from uuid import UUID

from sqlalchemy.orm import Session

from app.models.tenant import Tenant


class TenantRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_contact_email(self, email: str) -> Tenant | None:
        return self.db.query(Tenant).filter(Tenant.contact_email == email).one_or_none()

    def get_by_id(self, tenant_id: UUID) -> Tenant | None:
        return self.db.query(Tenant).filter(Tenant.id == tenant_id).one_or_none()

    def create(self, *, company_name: str, contact_email: str) -> Tenant:
        tenant = Tenant(company_name=company_name, contact_email=contact_email)
        self.db.add(tenant)
        self.db.flush()
        return tenant
