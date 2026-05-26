from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_tenant_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.audit import ApprovalQueueItem, AuditLogOut, StockAdjustmentRequestCreate
from app.schemas.common import ApiResponse
from app.services.audit_service import ApprovalService, AuditService

router = APIRouter(tags=["audit"])
DbSession = Annotated[Session, Depends(get_db)]
Approver = Annotated[User, Depends(require_tenant_roles(UserRole.RETAILER_ADMIN))]
OperationalRequester = Annotated[
    User,
    Depends(require_tenant_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF)),
]
AuditReader = Annotated[User, Depends(require_tenant_roles(UserRole.RETAILER_ADMIN, UserRole.AUDITOR))]


def _tenant_id(current_user: User) -> UUID:
    if current_user.tenant_id is None:
        raise ValueError("Tenant-scoped user required.")
    return current_user.tenant_id


@router.get("/audit-logs", response_model=ApiResponse)
def list_audit_logs(
    db: DbSession,
    current_user: AuditReader,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> ApiResponse:
    logs = AuditService(db).list_logs(current_user, limit, offset)
    data = [
        AuditLogOut(
            id=log.id,
            tenant_id=log.tenant_id,
            actor_id=log.actor_id,
            actor_name=log.actor.name if log.actor else None,
            actor_role=log.actor.role.value if log.actor and log.actor.role else None,
            module=log.module,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            old_value=log.old_value,
            new_value=log.new_value,
            message=log.message,
            created_at=log.created_at,
        ).model_dump(mode="json")
        for log in logs
    ]
    return ApiResponse(message="Audit logs fetched successfully.", data=data)


@router.get("/approvals", response_model=ApiResponse)
def approval_queue(db: DbSession, current_user: Approver) -> ApiResponse:
    items = [ApprovalQueueItem(**item).model_dump(mode="json") for item in ApprovalService(db).approval_queue(_tenant_id(current_user))]
    return ApiResponse(message="Approval queue fetched successfully.", data=items)


@router.post("/approvals/stock-adjustments", response_model=ApiResponse)
def request_stock_adjustment(
    payload: StockAdjustmentRequestCreate,
    db: DbSession,
    current_user: OperationalRequester,
) -> ApiResponse:
    request = ApprovalService(db).request_stock_adjustment(
        tenant_id=_tenant_id(current_user),
        current_user=current_user,
        payload=payload,
    )
    db.commit()
    return ApiResponse(message="Stock adjustment request submitted for approval.", data={"id": request.id, "status": request.status})


@router.post("/approvals/stock-adjustments/{request_id}/approve", response_model=ApiResponse)
def approve_stock_adjustment(request_id: UUID, db: DbSession, current_user: Approver) -> ApiResponse:
    request = ApprovalService(db).approve_stock_adjustment(_tenant_id(current_user), request_id, current_user)
    db.commit()
    return ApiResponse(message="Stock adjustment approved.", data={"id": request.id, "status": request.status})


@router.post("/approvals/stock-adjustments/{request_id}/reject", response_model=ApiResponse)
def reject_stock_adjustment(request_id: UUID, db: DbSession, current_user: Approver) -> ApiResponse:
    request = ApprovalService(db).reject_stock_adjustment(_tenant_id(current_user), request_id, current_user)
    db.commit()
    return ApiResponse(message="Stock adjustment rejected.", data={"id": request.id, "status": request.status})
