from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    id: UUID
    type: str
    group: str
    title: str
    message: str
    entity_type: str | None
    entity_id: UUID | None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityFeedItem(BaseModel):
    id: str
    type: str
    group: str
    title: str
    message: str
    created_at: datetime
