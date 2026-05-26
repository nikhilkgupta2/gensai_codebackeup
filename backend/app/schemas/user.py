from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.enums import UserRole


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.INVENTORY_MANAGER
    tenant_id: UUID | None = None
    is_active: bool = True
    assigned_warehouse: str | None = Field(default=None, max_length=255)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    tenant_id: UUID | None = None
    is_active: bool | None = None
    assigned_warehouse: str | None = Field(default=None, max_length=255)


class UserOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    name: str
    email: str
    role: UserRole
    is_active: bool
    assigned_warehouse: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
