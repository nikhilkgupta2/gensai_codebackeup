from uuid import UUID

from pydantic import BaseModel, Field
from pydantic import ConfigDict


class ProductCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=255)
    brand: str | None = Field(default=None, max_length=255)
    quantity: int = Field(default=0, ge=0)
    price: float | None = Field(default=None, ge=0)
    supplier: str | None = Field(default=None, max_length=255)
    warehouse_location: str | None = Field(default=None, max_length=255)
    description: str | None = None


class ProductUpdate(BaseModel):
    product_name: str | None = Field(default=None, min_length=1, max_length=255)
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=255)
    brand: str | None = Field(default=None, max_length=255)
    quantity: int | None = Field(default=None, ge=0)
    price: float | None = Field(default=None, ge=0)
    supplier: str | None = Field(default=None, max_length=255)
    warehouse_location: str | None = Field(default=None, max_length=255)
    description: str | None = None


class ProductOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    product_name: str
    sku: str
    category: str | None
    brand: str | None
    quantity: int
    price: float | None
    supplier: str | None
    warehouse_location: str | None
    description: str | None

    model_config = ConfigDict(from_attributes=True)
