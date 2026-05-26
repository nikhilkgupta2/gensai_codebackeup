from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditLogOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    actor_id: UUID | None
    actor_name: str | None = None
    actor_role: str | None = None
    module: str
    action: str
    entity_type: str
    entity_id: UUID | None
    old_value: dict | None
    new_value: dict | None
    message: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockAdjustmentRequestCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(ne=0)
    notes: str | None = None


class ApprovalQueueItem(BaseModel):
    id: UUID
    type: str
    title: str
    description: str
    status: str
    requested_by: UUID | None
    requested_by_name: str | None = None
    created_at: datetime
    metadata: dict = {}
