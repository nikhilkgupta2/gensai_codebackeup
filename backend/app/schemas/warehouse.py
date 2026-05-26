from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WarehouseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=40)
    address: str | None = Field(default=None, max_length=1000)
    manager: str | None = Field(default=None, max_length=255)


class WarehouseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=2, max_length=40)
    address: str | None = Field(default=None, max_length=1000)
    manager: str | None = Field(default=None, max_length=255)


class WarehouseOut(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    code: str
    address: str | None
    manager: str | None
    created_at: datetime
    updated_at: datetime
    product_count: int = 0
    total_units: int = 0
    low_stock_items: int = 0

    model_config = ConfigDict(from_attributes=True)


class WarehouseInventoryOut(BaseModel):
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    product_name: str
    sku: str
    category: str | None
    quantity: int
    stock_status: str

    model_config = ConfigDict(from_attributes=True)


class WarehouseInventoryAssign(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=0)


class StockTransferCreate(BaseModel):
    product_id: UUID
    source_warehouse_id: UUID
    destination_warehouse_id: UUID
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_distinct_warehouses(self):
        if self.source_warehouse_id == self.destination_warehouse_id:
            raise ValueError("Source and destination warehouses must be different.")
        return self


class StockTransferApproval(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=1000)


class StockTransferItemOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    sku: str
    quantity: int
    approved_quantity: int

    model_config = ConfigDict(from_attributes=True)


class StockTransferOut(BaseModel):
    id: UUID
    tenant_id: UUID
    product_id: UUID
    product_name: str
    sku: str
    source_warehouse_id: UUID
    source_warehouse_name: str
    destination_warehouse_id: UUID
    destination_warehouse_name: str
    quantity: int
    status: str
    requested_by: UUID | None
    approved_by: UUID | None
    rejected_by: UUID | None = None
    notes: str | None
    admin_notes: str | None = None
    items: list[StockTransferItemOut] = []
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
