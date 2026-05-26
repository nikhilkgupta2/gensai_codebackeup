from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_operational_user, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.inventory import (
    InventoryAdjustmentCreate,
    InventoryScanCreate,
    InventoryScanOut,
    InventoryTransactionCreate,
    InventoryTransactionOut,
)
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _tenant_id_or_forbid(current_user: User) -> UUID:
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inventory changes require a tenant-scoped user.",
        )
    return current_user.tenant_id


def _warehouse_scope_or_forbid(current_user: User) -> str | None:
    if current_user.role != UserRole.WAREHOUSE_STAFF:
        return None
    if not current_user.assigned_warehouse:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Warehouse staff must be assigned to a warehouse before inventory operations.",
        )
    return current_user.assigned_warehouse


def _transaction_data(tx) -> dict:
    return InventoryTransactionOut.model_validate(tx).model_dump(mode="json")


def _scan_data(scan) -> dict:
    return InventoryScanOut(
        id=scan.id,
        product_id=scan.product_id,
        product_name=scan.product.product_name,
        sku=scan.product.sku,
        code=scan.code,
        source=scan.source,
        created_at=scan.created_at,
    ).model_dump(mode="json")


@router.post("/stock-in", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def stock_in(
    payload: InventoryTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF)
    ),
) -> ApiResponse:
    service = InventoryService(db)
    try:
        tx = service.stock_in(
            _tenant_id_or_forbid(current_user),
            payload,
            current_user.id,
            _warehouse_scope_or_forbid(current_user),
        )
        db.commit()
        db.refresh(tx)
        return ApiResponse(message="Stock added successfully.", data=_transaction_data(tx))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/stock-out", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def stock_out(
    payload: InventoryTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF)
    ),
) -> ApiResponse:
    service = InventoryService(db)
    try:
        tx = service.stock_out(
            _tenant_id_or_forbid(current_user),
            payload,
            current_user.id,
            _warehouse_scope_or_forbid(current_user),
        )
        db.commit()
        db.refresh(tx)
        return ApiResponse(message="Stock removed successfully.", data=_transaction_data(tx))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/adjustment", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def adjustment(
    payload: InventoryAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF)
    ),
) -> ApiResponse:
    if current_user.role == UserRole.INVENTORY_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inventory manager adjustments require Retailer Admin approval.",
        )

    service = InventoryService(db)
    try:
        tx = service.adjustment(
            _tenant_id_or_forbid(current_user),
            payload,
            current_user.id,
            _warehouse_scope_or_forbid(current_user),
        )
        db.commit()
        db.refresh(tx)
        return ApiResponse(message="Inventory adjusted successfully.", data=_transaction_data(tx))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/history", response_model=ApiResponse)
def history(
    product_id: UUID | None = Query(None),
    transaction_type: str | None = Query(None, pattern="^(STOCK_IN|STOCK_OUT|ADJUSTMENT)$"),
    warehouse_location: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operational_user),
) -> ApiResponse:
    service = InventoryService(db)
    try:
        transactions = service.history(
            tenant_id=current_user.tenant_id,
            product_id=product_id,
            warehouse_location=_warehouse_scope_or_forbid(current_user) or warehouse_location,
            transaction_type=transaction_type,
            search=search,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    data = [_transaction_data(tx) for tx in transactions]
    return ApiResponse(message="Inventory history fetched successfully.", data=data)


@router.post("/scans", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def scan_product(
    payload: InventoryScanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF)
    ),
) -> ApiResponse:
    service = InventoryService(db)
    try:
        scan = service.scan_product(
            _tenant_id_or_forbid(current_user),
            payload.code,
            current_user.id,
            _warehouse_scope_or_forbid(current_user),
            payload.source,
        )
        db.commit()
        db.refresh(scan)
        return ApiResponse(message="Product scan recorded successfully.", data=_scan_data(scan))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
