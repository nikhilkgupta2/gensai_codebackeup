from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.notification import ActivityFeedItem, NotificationOut
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=ApiResponse)
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    include_read: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse:
    notifications = NotificationService(db).list_notifications(current_user, limit, include_read)
    db.commit()
    data = [NotificationOut.model_validate(item).model_dump(mode="json") for item in notifications]
    return ApiResponse(message="Notifications fetched successfully.", data=data)


@router.get("/unread-count", response_model=ApiResponse)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse:
    count = NotificationService(db).unread_count(current_user)
    db.commit()
    return ApiResponse(message="Unread count fetched successfully.", data={"count": count})


@router.post("/mark-read", response_model=ApiResponse)
def mark_read(
    notification_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse:
    count = NotificationService(db).mark_read(current_user, notification_id)
    db.commit()
    return ApiResponse(message="Notifications marked as read.", data={"updated": count})


@router.get("/activity-feed", response_model=ApiResponse)
def activity_feed(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse:
    feed = NotificationService(db).activity_feed(current_user, limit)
    data = [ActivityFeedItem(**item).model_dump(mode="json") for item in feed]
    return ApiResponse(message="Activity feed fetched successfully.", data=data)
