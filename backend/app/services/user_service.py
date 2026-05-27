from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.core.security import hash_password
from app.models.user import User
from app.repositories.tenant_repository import TenantRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tenants = TenantRepository(db)

    def list(
        self,
        *,
        current_user: User,
        search: str | None,
        role: UserRole | None,
        is_active: bool | None,
        limit: int,
        offset: int,
    ) -> list[User]:
        tenant_id = self._tenant_scope(current_user)
        return self.users.list(
            tenant_id=tenant_id,
            search=search,
            role=role,
            is_active=is_active,
            limit=limit,
            offset=offset,
        )

    def count(
        self,
        *,
        current_user: User,
        search: str | None,
        role: UserRole | None,
        is_active: bool | None,
    ) -> int:
        tenant_id = self._tenant_scope(current_user)
        return self.users.count(
            tenant_id=tenant_id,
            search=search,
            role=role,
            is_active=is_active,
        )

    def get_visible(self, *, current_user: User, user_id: UUID) -> User:
        user = self.users.get_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        self._ensure_can_read(current_user, user)
        return user

    def create(self, *, current_user: User, payload: UserCreate) -> User:
        self._ensure_can_manage_users(current_user)
        role = payload.role
        tenant_id = self._resolve_write_tenant(current_user, payload.tenant_id, role)
        self._ensure_can_assign_role(current_user, role)
        self._ensure_email_available(payload.email, tenant_id=tenant_id)

        try:
            return self.users.create(
                name=payload.name,
                email=payload.email.lower(),
                password_hash=hash_password(payload.password),
                tenant_id=tenant_id,
                role=role,
                is_active=payload.is_active,
                is_email_verified=True,
                assigned_warehouse=self._normalize_warehouse(payload.assigned_warehouse, role),
            )
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            ) from exc

    def update(self, *, current_user: User, user_id: UUID, payload: UserUpdate) -> User:
        self._ensure_can_manage_users(current_user)
        user = self.get_visible(current_user=current_user, user_id=user_id)
        data = payload.model_dump(exclude_unset=True)

        next_role = data.get("role", user.role)
        next_tenant_id = data.get("tenant_id", user.tenant_id)
        if "role" in data or "tenant_id" in data:
            next_tenant_id = self._resolve_write_tenant(current_user, next_tenant_id, next_role)
            self._ensure_can_assign_role(current_user, next_role)

        if user.id == current_user.id:
            if data.get("role", user.role) != user.role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot change your own role.",
                )
            if data.get("is_active") is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot deactivate your own account.",
                )
            if "tenant_id" in data and next_tenant_id != user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot move your own account to another tenant.",
                )

        if "email" in data and data["email"] is not None:
            email = str(data["email"]).lower()
            self._ensure_email_available(email, tenant_id=next_tenant_id, user_id=user.id)
            user.email = email
        if "name" in data and data["name"] is not None:
            user.name = data["name"]
        if "password" in data and data["password"]:
            user.password_hash = hash_password(data["password"])
        if "role" in data:
            user.role = next_role
        if "tenant_id" in data:
            user.tenant_id = next_tenant_id
        if "is_active" in data and data["is_active"] is not None:
            user.is_active = data["is_active"]
        if "assigned_warehouse" in data or "role" in data:
            user.assigned_warehouse = self._normalize_warehouse(
                data.get("assigned_warehouse", user.assigned_warehouse),
                next_role,
            )

        try:
            self.db.flush()
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            ) from exc
        return user

    def delete(self, *, current_user: User, user_id: UUID) -> None:
        self._ensure_can_manage_users(current_user)
        user = self.get_visible(current_user=current_user, user_id=user_id)
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your own account.",
            )
        if current_user.role != UserRole.SUPER_ADMIN and user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot manage this user.",
            )
        self.users.delete(user)

    def _tenant_scope(self, current_user: User) -> UUID | None:
        if current_user.role == UserRole.SUPER_ADMIN:
            return None
        if current_user.tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action requires a tenant-scoped user.",
            )
        return current_user.tenant_id

    def _ensure_can_read(self, current_user: User, user: User) -> None:
        if current_user.role == UserRole.SUPER_ADMIN:
            return
        if current_user.tenant_id is None or user.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    def _ensure_can_manage_users(self, current_user: User) -> None:
        if current_user.role not in {UserRole.SUPER_ADMIN, UserRole.RETAILER_ADMIN}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to manage users.",
            )

    def _ensure_can_assign_role(self, current_user: User, role: UserRole) -> None:
        if current_user.role == UserRole.SUPER_ADMIN:
            return
        if role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Retailer admins cannot assign the Super Admin role.",
            )
        if role not in {
            UserRole.RETAILER_ADMIN,
            UserRole.INVENTORY_MANAGER,
            UserRole.WAREHOUSE_STAFF,
            UserRole.AUDITOR,
            UserRole.PROCUREMENT_MANAGER,
        }:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot assign this role.",
            )

    def _normalize_warehouse(self, warehouse: str | None, role: UserRole) -> str | None:
        value = warehouse.strip() if warehouse else None
        if role != UserRole.WAREHOUSE_STAFF:
            return None
        return value or None

    def _resolve_write_tenant(
        self,
        current_user: User,
        tenant_id: UUID | None,
        role: UserRole,
    ) -> UUID | None:
        if current_user.role == UserRole.RETAILER_ADMIN:
            if current_user.tenant_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Retailer admins must belong to a tenant.",
                )
            if tenant_id is not None and tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You cannot manage users from another tenant.",
                )
            return current_user.tenant_id

        if role == UserRole.SUPER_ADMIN:
            return None

        if tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A tenant is required for tenant-scoped users.",
            )
        if self.tenants.get_by_id(tenant_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
        return tenant_id

    def _ensure_email_available(
        self,
        email: str,
        *,
        tenant_id: UUID | None,
        user_id: UUID | None = None,
    ) -> None:
        existing = self.users.get_by_email_for_update(email.lower(), user_id)
        if existing is None:
            return
        if existing.tenant_id == tenant_id:
            detail = "A user with this email already exists in this tenant."
        else:
            detail = "A user with this email already exists."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
