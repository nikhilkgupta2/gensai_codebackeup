from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_tenant_access, get_db, require_tenant_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])
DbSession = Annotated[Session, Depends(get_db)]
ProductReader = Annotated[
    User,
    Depends(
        require_tenant_roles(
            UserRole.RETAILER_ADMIN,
            UserRole.INVENTORY_MANAGER,
            UserRole.WAREHOUSE_STAFF,
            UserRole.AUDITOR,
            UserRole.PROCUREMENT_MANAGER,
        )
    ),
]
ProductManager = Annotated[User, Depends(require_tenant_roles(UserRole.RETAILER_ADMIN))]


def _warehouse_scope(current_user: User) -> str | None:
    if current_user.role != UserRole.WAREHOUSE_STAFF:
        return None
    return current_user.assigned_warehouse or "__unassigned_warehouse_staff__"


def _product_data(product, current_user: User) -> dict:
    data = ProductOut.model_validate(product).model_dump(mode="json")
    if current_user.role == UserRole.WAREHOUSE_STAFF:
        data.pop("price", None)
        data.pop("supplier", None)
        data.pop("description", None)
    return data


@router.get("", response_model=ApiResponse)
def list_products(
    db: DbSession,
    current_user: ProductReader,
    product_name: str | None = Query(None),
    sku: str | None = Query(None),
    category: str | None = Query(None),
    brand: str | None = Query(None),
    barcode: str | None = Query(None),
    supplier: str | None = Query(None),
    warehouse_location: str | None = Query(None),
    stock_status: str | None = Query(None, pattern="^(in_stock|low_stock|out_of_stock)$"),
    low_stock: bool = Query(False),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    offset: int | None = Query(None, ge=0),
):
    service = ProductService(db)
    tenant_id = getattr(current_user, "tenant_id", None)
    warehouse_scope = _warehouse_scope(current_user)
    warehouse_location_filter = warehouse_scope if warehouse_scope is not None else warehouse_location
    sku_filter = sku or barcode
    resolved_offset = offset if offset is not None else (page - 1) * limit
    products = service.list(
        tenant_id=tenant_id,
        limit=limit,
        offset=resolved_offset,
        product_name=product_name,
        sku=sku_filter,
        category=category,
        brand=brand,
        supplier=None if current_user.role == UserRole.WAREHOUSE_STAFF else supplier,
        warehouse_location=warehouse_location_filter,
        stock_status=stock_status,
        low_stock=low_stock,
        min_price=None if current_user.role == UserRole.WAREHOUSE_STAFF else min_price,
        max_price=None if current_user.role == UserRole.WAREHOUSE_STAFF else max_price,
    )
    total = service.count(
        tenant_id=tenant_id,
        product_name=product_name,
        sku=sku_filter,
        category=category,
        brand=brand,
        supplier=None if current_user.role == UserRole.WAREHOUSE_STAFF else supplier,
        warehouse_location=warehouse_location_filter,
        stock_status=stock_status,
        low_stock=low_stock,
        min_price=None if current_user.role == UserRole.WAREHOUSE_STAFF else min_price,
        max_price=None if current_user.role == UserRole.WAREHOUSE_STAFF else max_price,
    )
    data = [_product_data(product, current_user) for product in products]
    return ApiResponse(
        message="Products fetched successfully.",
        data=data,
        pagination={"page": page, "limit": limit, "total": total},
    )


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: DbSession,
    current_user: ProductManager,
):
    service = ProductService(db)
    tenant_id = getattr(current_user, "tenant_id", None)
    product = service.create(tenant_id=tenant_id, payload=payload)
    db.commit()
    db.refresh(product)
    data = _product_data(product, current_user)
    return ApiResponse(message="Product created successfully.", data=data)


@router.get("/{product_id}", response_model=ApiResponse)
def get_product(
    product_id: UUID,
    db: DbSession,
    current_user: ProductReader,
):
    service = ProductService(db)
    product = service.get(product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    ensure_tenant_access(current_user, product.tenant_id)
    if current_user.role == UserRole.WAREHOUSE_STAFF and product.warehouse_location != _warehouse_scope(current_user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    data = _product_data(product, current_user)
    return ApiResponse(message="Product fetched successfully.", data=data)


@router.put("/{product_id}", response_model=ApiResponse)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: DbSession,
    current_user: ProductManager,
):
    service = ProductService(db)
    product = service.get(product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    ensure_tenant_access(current_user, product.tenant_id)
    updated = service.update(product_id, payload)
    db.commit()
    db.refresh(updated)
    data = ProductOut.model_validate(updated).model_dump(mode="json")
    return ApiResponse(message="Product updated successfully.", data=data)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID,
    db: DbSession,
    current_user: ProductManager,
):
    service = ProductService(db)
    product = service.get(product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    ensure_tenant_access(current_user, product.tenant_id)
    service.delete(product_id)
    db.commit()
    return None
