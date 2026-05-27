from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.query(User).filter(User.id == user_id).one_or_none()

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).one_or_none()

    def get_by_email_for_update(self, email: str, user_id: UUID | None = None) -> User | None:
        query = self.db.query(User).filter(User.email == email)
        if user_id is not None:
            query = query.filter(User.id != user_id)
        return query.one_or_none()

    def list(
        self,
        *,
        tenant_id: UUID | None = None,
        search: str | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[User]:
        return (
            self._filtered_query(tenant_id=tenant_id, search=search, role=role, is_active=is_active)
            .order_by(User.name.asc(), User.email.asc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    def count(
        self,
        *,
        tenant_id: UUID | None = None,
        search: str | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
    ) -> int:
        return self._filtered_query(
            tenant_id=tenant_id,
            search=search,
            role=role,
            is_active=is_active,
        ).count()

    def _filtered_query(
        self,
        *,
        tenant_id: UUID | None = None,
        search: str | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
    ):
        query = self.db.query(User)
        if tenant_id is not None:
            query = query.filter(User.tenant_id == tenant_id)
        if search:
            pattern = f"%{search}%"
            query = query.filter(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
        if role is not None:
            query = query.filter(User.role == role)
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        return query

    def create(
        self,
        *,
        name: str,
        email: str,
        password_hash: str,
        tenant_id: UUID | None,
        role: UserRole = UserRole.RETAILER_ADMIN,
        is_active: bool = True,
        is_email_verified: bool = False,
        assigned_warehouse: str | None = None,
    ) -> User:
        user = User(
            name=name,
            email=email,
            password_hash=password_hash,
            tenant_id=tenant_id,
            role=role,
            is_active=is_active,
            is_email_verified=is_email_verified,
            assigned_warehouse=assigned_warehouse,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
