from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.product_scan_log import ProductScanLog


class ScanRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        tenant_id: UUID,
        product_id: UUID,
        scanned_by: UUID | None,
        code: str,
        source: str = "manual",
    ) -> ProductScanLog:
        log = ProductScanLog(
            tenant_id=tenant_id,
            product_id=product_id,
            scanned_by=scanned_by,
            code=code,
            source=source,
        )
        self.db.add(log)
        self.db.flush()
        return log

    def count_today(self, tenant_id: UUID, warehouse_location: str | None = None) -> int:
        start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        query = self.db.query(func.count(ProductScanLog.id)).filter(
            ProductScanLog.tenant_id == tenant_id,
            ProductScanLog.created_at >= start,
        )
        if warehouse_location:
            query = query.join(Product, Product.id == ProductScanLog.product_id).filter(
                Product.warehouse_location == warehouse_location
            )
        return int(query.scalar() or 0)

    def recent(
        self,
        tenant_id: UUID,
        limit: int = 8,
        warehouse_location: str | None = None,
    ) -> list[dict]:
        query = (
            self.db.query(
                ProductScanLog.id,
                ProductScanLog.product_id,
                Product.product_name,
                Product.sku,
                ProductScanLog.code,
                ProductScanLog.source,
                ProductScanLog.created_at,
            )
            .join(Product, Product.id == ProductScanLog.product_id)
            .filter(ProductScanLog.tenant_id == tenant_id)
            .order_by(ProductScanLog.created_at.desc())
        )
        if warehouse_location:
            query = query.filter(Product.warehouse_location == warehouse_location)
        return [
            {
                "id": row.id,
                "product_id": row.product_id,
                "product_name": row.product_name,
                "sku": row.sku,
                "code": row.code,
                "source": row.source,
                "created_at": row.created_at,
            }
            for row in query.limit(limit).all()
        ]
