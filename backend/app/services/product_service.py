from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate


class ProductService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProductRepository(db)

    def list(
        self,
        tenant_id: UUID | None,
        limit: int = 100,
        offset: int = 0,
        product_name: str | None = None,
        sku: str | None = None,
        category: str | None = None,
        brand: str | None = None,
        supplier: str | None = None,
        warehouse_location: str | None = None,
        stock_status: str | None = None,
        low_stock: bool = False,
        min_price: float | None = None,
        max_price: float | None = None,
    ):
        return self.repo.list_by_tenant(
            tenant_id=tenant_id,
            limit=limit,
            offset=offset,
            product_name=product_name,
            sku=sku,
            category=category,
            brand=brand,
            supplier=supplier,
            warehouse_location=warehouse_location,
            stock_status=stock_status,
            low_stock=low_stock,
            min_price=min_price,
            max_price=max_price,
        )

    def count(
        self,
        tenant_id: UUID | None,
        product_name: str | None = None,
        sku: str | None = None,
        category: str | None = None,
        brand: str | None = None,
        supplier: str | None = None,
        warehouse_location: str | None = None,
        stock_status: str | None = None,
        low_stock: bool = False,
        min_price: float | None = None,
        max_price: float | None = None,
    ) -> int:
        return self.repo.count_by_tenant(
            tenant_id=tenant_id,
            product_name=product_name,
            sku=sku,
            category=category,
            brand=brand,
            supplier=supplier,
            warehouse_location=warehouse_location,
            stock_status=stock_status,
            low_stock=low_stock,
            min_price=min_price,
            max_price=max_price,
        )

    def get(self, product_id: UUID) -> Product | None:
        return self.repo.get_by_id(product_id)

    def create(self, tenant_id: UUID | None, payload: ProductCreate) -> Product:
        data = payload.model_dump()
        if data.get("quantity") is None:
            data["quantity"] = 0
        if self.repo.get_by_sku_for_update(data["sku"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A product with this SKU already exists.",
            )
        return self.repo.create(tenant_id=tenant_id, **data)

    def update(self, product_id: UUID, payload: ProductUpdate) -> Product | None:
        product = self.repo.get_by_id(product_id)
        if not product:
            return None
        data = payload.model_dump(exclude_unset=True)
        if "sku" in data and self.repo.get_by_sku_for_update(data["sku"], product_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A product with this SKU already exists.",
            )
        for k, v in data.items():
            setattr(product, k, v)
        return product

    def delete(self, product_id: UUID) -> bool:
        product = self.repo.get_by_id(product_id)
        if not product:
            return False
        self.db.delete(product)
        return True
