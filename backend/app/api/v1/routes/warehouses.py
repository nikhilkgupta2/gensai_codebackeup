from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_tenant_roles
from app.core.enums import UserRole
from app.models.user import User
from app.models.warehouse import StockTransfer, Warehouse, WarehouseInventory
from app.schemas.common import ApiResponse
from app.schemas.warehouse import (
    StockTransferCreate,
    StockTransferApproval,
    StockTransferOut,
    WarehouseCreate,
    WarehouseInventoryAssign,
    WarehouseInventoryOut,
    WarehouseOut,
    WarehouseUpdate,
)
from app.services.warehouse_service import WarehouseService

router = APIRouter(prefix="/warehouses", tags=["warehouses"])
DbSession = Annotated[Session, Depends(get_db)]
WarehouseReader = Annotated[
    User,
    Depends(require_tenant_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER, UserRole.WAREHOUSE_STAFF, UserRole.AUDITOR, UserRole.PROCUREMENT_MANAGER)),
]
WarehouseManager = Annotated[User, Depends(require_tenant_roles(UserRole.RETAILER_ADMIN, UserRole.INVENTORY_MANAGER))]
WarehouseApprover = Annotated[User, Depends(require_tenant_roles(UserRole.RETAILER_ADMIN))]


def _warehouse_data(warehouse: Warehouse) -> dict:
    data = WarehouseOut.model_validate(warehouse).model_dump(mode="json")
    data.update(
        {
            "product_count": len(warehouse.inventory_items),
            "total_units": sum(item.quantity for item in warehouse.inventory_items),
            "low_stock_items": sum(1 for item in warehouse.inventory_items if item.quantity <= 10),
        }
    )
    return data


def _inventory_data(item: WarehouseInventory) -> dict:
    return WarehouseInventoryOut.model_validate(
        {
            "id": item.id,
            "warehouse_id": item.warehouse_id,
            "product_id": item.product_id,
            "product_name": item.product.product_name,
            "sku": item.product.sku,
            "category": item.product.category,
            "quantity": item.quantity,
            "stock_status": "out_of_stock" if item.quantity <= 0 else "low_stock" if item.quantity <= 10 else "available",
        }
    ).model_dump(mode="json")


def _transfer_data(transfer: StockTransfer) -> dict:
    return StockTransferOut.model_validate(
        {
            "id": transfer.id,
            "tenant_id": transfer.tenant_id,
            "product_id": transfer.product_id,
            "product_name": transfer.product.product_name,
            "sku": transfer.product.sku,
            "source_warehouse_id": transfer.source_warehouse_id,
            "source_warehouse_name": transfer.source_warehouse.name,
            "destination_warehouse_id": transfer.destination_warehouse_id,
            "destination_warehouse_name": transfer.destination_warehouse.name,
            "quantity": transfer.quantity,
            "status": transfer.status,
            "requested_by": transfer.requested_by,
            "approved_by": transfer.approved_by,
            "notes": transfer.notes,
            "admin_notes": transfer.admin_notes,
            "rejected_by": transfer.rejected_by,
            "items": [
                {
                    "id": item.id,
                    "product_id": item.product_id,
                    "product_name": item.product.product_name,
                    "sku": item.product.sku,
                    "quantity": item.quantity,
                    "approved_quantity": item.approved_quantity,
                }
                for item in transfer.items
            ],
            "created_at": transfer.created_at,
            "updated_at": transfer.updated_at,
            "approved_at": transfer.approved_at,
            "rejected_at": transfer.rejected_at,
            "completed_at": transfer.completed_at,
        }
    ).model_dump(mode="json")


@router.get("", response_model=ApiResponse)
def list_warehouses(db: DbSession, current_user: WarehouseReader, search: str | None = Query(None, max_length=255)) -> ApiResponse:
    warehouses = WarehouseService(db).list_warehouses(current_user.tenant_id, search)
    if current_user.role == UserRole.WAREHOUSE_STAFF and current_user.assigned_warehouse:
        warehouses = [warehouse for warehouse in warehouses if warehouse.name == current_user.assigned_warehouse]
    return ApiResponse(message="Warehouses fetched successfully.", data=[_warehouse_data(warehouse) for warehouse in warehouses])


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(payload: WarehouseCreate, db: DbSession, current_user: WarehouseManager) -> ApiResponse:
    warehouse = WarehouseService(db).create_warehouse(current_user.tenant_id, payload)
    db.commit()
    db.refresh(warehouse)
    return ApiResponse(message="Warehouse created successfully.", data=_warehouse_data(warehouse))


@router.get("/inventory", response_model=ApiResponse)
def list_warehouse_inventory(
    db: DbSession,
    current_user: WarehouseReader,
    warehouse_id: UUID | None = Query(None),
    search: str | None = Query(None, max_length=255),
) -> ApiResponse:
    items = WarehouseService(db).list_inventory(current_user.tenant_id, warehouse_id, search)
    if current_user.role == UserRole.WAREHOUSE_STAFF and current_user.assigned_warehouse:
        items = [item for item in items if item.warehouse.name == current_user.assigned_warehouse]
    return ApiResponse(message="Warehouse inventory fetched successfully.", data=[_inventory_data(item) for item in items])


@router.post("/{warehouse_id}/inventory", response_model=ApiResponse)
def assign_warehouse_inventory(
    warehouse_id: UUID,
    payload: WarehouseInventoryAssign,
    db: DbSession,
    current_user: WarehouseManager,
) -> ApiResponse:
    item = WarehouseService(db).assign_product(
        current_user.tenant_id,
        warehouse_id,
        payload.product_id,
        payload.quantity,
        current_user.id,
    )
    db.commit()
    db.refresh(item)
    return ApiResponse(message="Product assigned to warehouse successfully.", data=_inventory_data(item))


@router.get("/transfers", response_model=ApiResponse)
def list_stock_transfers(
    db: DbSession,
    current_user: WarehouseReader,
    status_filter: str | None = Query(None, alias="status", pattern="^(pending|approved|rejected|completed|cancelled)$"),
) -> ApiResponse:
    transfers = WarehouseService(db).list_transfers(current_user.tenant_id, status_filter)
    if current_user.role == UserRole.WAREHOUSE_STAFF and current_user.assigned_warehouse:
        transfers = [
            transfer
            for transfer in transfers
            if transfer.source_warehouse.name == current_user.assigned_warehouse
            or transfer.destination_warehouse.name == current_user.assigned_warehouse
        ]
    return ApiResponse(message="Stock transfers fetched successfully.", data=[_transfer_data(transfer) for transfer in transfers])


@router.post("/transfers", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_stock_transfer(payload: StockTransferCreate, db: DbSession, current_user: WarehouseManager) -> ApiResponse:
    transfer = WarehouseService(db).create_transfer(current_user.tenant_id, payload, current_user.id)
    db.commit()
    db.refresh(transfer)
    return ApiResponse(message="Stock transfer requested successfully.", data=_transfer_data(transfer))


@router.post("/transfers/{transfer_id}/approve", response_model=ApiResponse)
def approve_stock_transfer(
    transfer_id: UUID,
    db: DbSession,
    current_user: WarehouseApprover,
    payload: StockTransferApproval | None = None,
) -> ApiResponse:
    transfer = WarehouseService(db).transition_transfer(
        current_user.tenant_id,
        transfer_id,
        "approve",
        current_user.id,
        payload.admin_notes if payload else None,
    )
    db.commit()
    db.refresh(transfer)
    return ApiResponse(message="Stock transfer approved successfully.", data=_transfer_data(transfer))


@router.post("/transfers/{transfer_id}/complete", response_model=ApiResponse)
def complete_stock_transfer(transfer_id: UUID, db: DbSession, current_user: WarehouseManager) -> ApiResponse:
    transfer = WarehouseService(db).transition_transfer(current_user.tenant_id, transfer_id, "complete", current_user.id)
    db.commit()
    db.refresh(transfer)
    return ApiResponse(message="Stock transfer completed successfully.", data=_transfer_data(transfer))


@router.post("/transfers/{transfer_id}/cancel", response_model=ApiResponse)
def cancel_stock_transfer(
    transfer_id: UUID,
    db: DbSession,
    current_user: WarehouseManager,
    payload: StockTransferApproval | None = None,
) -> ApiResponse:
    transfer = WarehouseService(db).transition_transfer(
        current_user.tenant_id,
        transfer_id,
        "cancel",
        current_user.id,
        payload.admin_notes if payload else None,
    )
    db.commit()
    db.refresh(transfer)
    return ApiResponse(message="Stock transfer cancelled successfully.", data=_transfer_data(transfer))


@router.put("/{warehouse_id}", response_model=ApiResponse)
def update_warehouse(warehouse_id: UUID, payload: WarehouseUpdate, db: DbSession, current_user: WarehouseManager) -> ApiResponse:
    warehouse = WarehouseService(db).update_warehouse(current_user.tenant_id, warehouse_id, payload)
    db.commit()
    db.refresh(warehouse)
    return ApiResponse(message="Warehouse updated successfully.", data=_warehouse_data(warehouse))


@router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(warehouse_id: UUID, db: DbSession, current_user: WarehouseManager):
    WarehouseService(db).delete_warehouse(current_user.tenant_id, warehouse_id)
    db.commit()
    return None
