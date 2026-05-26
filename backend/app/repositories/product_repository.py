from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.product import Product


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, product_id: UUID) -> Product | None:
        return self.db.query(Product).filter(Product.id == product_id).one_or_none()

    def get_by_sku(self, sku: str) -> Product | None:
        return self.db.query(Product).filter(Product.sku == sku).one_or_none()

    def get_by_sku_for_update(self, sku: str, product_id: UUID | None = None) -> Product | None:
        query = self.db.query(Product).filter(Product.sku == sku)
        if product_id is not None:
            query = query.filter(Product.id != product_id)
        return query.one_or_none()

    def list_by_tenant(
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
    ) -> Iterable[Product]:
        q = self._filtered_query(
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
        return q.order_by(Product.product_name).limit(limit).offset(offset).all()

    def count_by_tenant(
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
        return self._filtered_query(
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
        ).count()

    def _filtered_query(
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
    ):
        q = self.db.query(Product)
        if tenant_id is not None:
            q = q.filter(Product.tenant_id == tenant_id)
        if product_name:
            q = q.filter(Product.product_name.ilike(f"%{product_name}%"))
        if sku:
            q = q.filter(Product.sku.ilike(f"%{sku}%"))
        if category:
            q = q.filter(Product.category.ilike(f"%{category}%"))
        if brand:
            q = q.filter(Product.brand.ilike(f"%{brand}%"))
        if supplier:
            q = q.filter(Product.supplier.ilike(f"%{supplier}%"))
        if warehouse_location:
            q = q.filter(Product.warehouse_location == warehouse_location)
        if stock_status == "in_stock":
            q = q.filter(Product.quantity > 10)
        elif stock_status == "low_stock":
            q = q.filter(Product.quantity.between(1, 10))
        elif stock_status == "out_of_stock":
            q = q.filter(Product.quantity == 0)
        if low_stock:
            q = q.filter(or_(Product.quantity <= 10, Product.quantity == 0))
        if min_price is not None:
            q = q.filter(Product.price >= min_price)
        if max_price is not None:
            q = q.filter(Product.price <= max_price)
        return q

    def create(self, *, tenant_id: UUID | None, product_name: str, sku: str, **kwargs) -> Product:
        product = Product(
            tenant_id=tenant_id,
            product_name=product_name,
            sku=sku,
            **kwargs,
        )
        self.db.add(product)
        self.db.flush()
        return product
