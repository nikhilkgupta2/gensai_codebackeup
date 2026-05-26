from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InventoryTransactionCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0)
    notes: str | None = None


class InventoryAdjustmentCreate(BaseModel):
    product_id: UUID
    quantity: int
    notes: str | None = None


class InventoryTransactionOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    product_id: UUID
    transaction_type: Literal["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]
    quantity: int
    updated_by: UUID | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryScanCreate(BaseModel):
    code: str = Field(min_length=1, max_length=255)
    source: str = Field(default="manual", max_length=50)


class InventoryScanOut(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    sku: str
    code: str
    source: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
