from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/retailer", response_model=ApiResponse)
def retailer_dashboard(
    db: DbSession,
    current_user: Annotated[
        User,
        Depends(require_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER)),
    ],
) -> ApiResponse:
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Retailer dashboard requires a tenant-scoped user.",
        )
    data = DashboardService(db).retailer_dashboard(current_user.tenant_id)
    return ApiResponse(
        message="Retailer dashboard fetched successfully.",
        data=data.model_dump(mode="json"),
    )


@router.get("/warehouse-staff", response_model=ApiResponse)
def warehouse_staff_dashboard(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.WAREHOUSE_STAFF))],
) -> ApiResponse:
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Warehouse staff dashboard requires a tenant-scoped user.",
        )
    data = DashboardService(db).warehouse_staff_dashboard(
        current_user.tenant_id,
        current_user.assigned_warehouse,
    )
    return ApiResponse(
        message="Warehouse staff dashboard fetched successfully.",
        data=data.model_dump(mode="json"),
    )


@router.get("/auditor", response_model=ApiResponse)
def auditor_dashboard(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.AUDITOR))],
) -> ApiResponse:
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auditor dashboard requires a tenant-scoped user.",
        )
    data = DashboardService(db).auditor_dashboard(current_user.tenant_id)
    return ApiResponse(
        message="Auditor dashboard fetched successfully.",
        data=data.model_dump(mode="json"),
    )


@router.get("/procurement", response_model=ApiResponse)
def procurement_dashboard(
    db: DbSession,
    current_user: Annotated[
        User,
        Depends(require_roles(UserRole.RETAILER_ADMIN, UserRole.PROCUREMENT_MANAGER)),
    ],
) -> ApiResponse:
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Procurement dashboard requires a tenant-scoped user.",
        )
    data = DashboardService(db).procurement_dashboard(current_user.tenant_id)
    return ApiResponse(
        message="Procurement dashboard fetched successfully.",
        data=data.model_dump(mode="json"),
    )


@router.get("/admin", response_model=ApiResponse)
def admin_dashboard(
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> ApiResponse:
    data = DashboardService(db).admin_dashboard()
    return ApiResponse(
        message="Admin dashboard fetched successfully.",
        data=data.model_dump(mode="json"),
    )


@router.get("/admin/tenants/{tenant_id}", response_model=ApiResponse)
def admin_tenant_drilldown(
    tenant_id: UUID,
    db: DbSession,
    current_user: Annotated[User, Depends(require_roles(UserRole.SUPER_ADMIN))],
) -> ApiResponse:
    data = DashboardService(db).admin_tenant_drilldown(tenant_id)
    return ApiResponse(
        message="Tenant analytics fetched successfully.",
        data=data.model_dump(mode="json"),
    )
