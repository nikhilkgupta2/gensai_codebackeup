import csv
from io import StringIO
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import SupplierStatus
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.warehouse import WarehouseInventory
from app.repositories.product_repository import ProductRepository
from app.repositories.warehouse_repository import WarehouseRepository
from app.schemas.imports import (
    DuplicateStrategy,
    ImportApplyResult,
    ImportErrorItem,
    ImportPreview,
    ImportType,
)


class CsvImportService:
    PRODUCT_HEADERS = [
        "product_name",
        "sku",
        "category",
        "brand",
        "quantity",
        "price",
        "supplier",
        "warehouse_location",
        "description",
    ]
    SUPPLIER_HEADERS = [
        "name",
        "contact_name",
        "contact_email",
        "contact_phone",
        "address",
        "status",
        "notes",
    ]
    WAREHOUSE_INVENTORY_HEADERS = ["warehouse_code", "sku", "quantity"]

    def __init__(self, db: Session) -> None:
        self.db = db
        self.products = ProductRepository(db)
        self.warehouses = WarehouseRepository(db)

    def preview(self, tenant_id: UUID, import_type: ImportType, contents: bytes) -> ImportPreview:
        headers, rows = self._read_csv(contents)
        required_headers = self._headers_for(import_type)
        missing_headers = [header for header in required_headers if header not in headers]
        if missing_headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV is missing required columns: {', '.join(missing_headers)}.",
            )

        normalized_rows: list[dict[str, str | int | float | None | bool]] = []
        errors: list[ImportErrorItem] = []
        duplicate_rows = 0

        seen_keys: set[str] = set()
        for row_number, row in enumerate(rows, start=2):
            normalized, row_errors, duplicate_key = self._validate_row(
                tenant_id, import_type, row, row_number, seen_keys
            )
            if duplicate_key:
                duplicate_rows += 1
            normalized_rows.append(normalized)
            errors.extend(row_errors)

        error_row_numbers = {error.row for error in errors}
        return ImportPreview(
            import_type=import_type,
            total_rows=len(rows),
            valid_rows=max(0, len(rows) - len(error_row_numbers)),
            duplicate_rows=duplicate_rows,
            error_rows=len(error_row_numbers),
            headers=headers,
            rows=normalized_rows[:50],
            errors=errors[:100],
        )

    def apply(
        self,
        tenant_id: UUID,
        import_type: ImportType,
        contents: bytes,
        duplicate_strategy: DuplicateStrategy,
    ) -> ImportApplyResult:
        preview = self.preview(tenant_id, import_type, contents)
        if preview.errors:
            return ImportApplyResult(import_type=import_type, errors=preview.errors)

        _, rows = self._read_csv(contents)
        result = ImportApplyResult(import_type=import_type)

        for row in rows:
            if import_type == "products":
                action = self._apply_product(tenant_id, row, duplicate_strategy)
            elif import_type == "suppliers":
                action = self._apply_supplier(tenant_id, row, duplicate_strategy)
            else:
                action = self._apply_warehouse_inventory(tenant_id, row, duplicate_strategy)

            if action == "created":
                result.created += 1
            elif action == "updated":
                result.updated += 1
            else:
                result.skipped += 1

        return result

    def _read_csv(self, contents: bytes) -> tuple[list[str], list[dict[str, str]]]:
        try:
            text = contents.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must be UTF-8 encoded."
            ) from None

        reader = csv.DictReader(StringIO(text))
        headers = [header.strip() for header in (reader.fieldnames or []) if header]
        if not headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must include a header row."
            )

        rows: list[dict[str, str]] = []
        for row in reader:
            rows.append(
                {
                    str(key).strip(): str(value or "").strip()
                    for key, value in row.items()
                    if key is not None
                }
            )

        if not rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV must include at least one data row.",
            )
        if len(rows) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV imports are limited to 1000 rows.",
            )
        return headers, rows

    def _headers_for(self, import_type: ImportType) -> list[str]:
        if import_type == "products":
            return self.PRODUCT_HEADERS
        if import_type == "suppliers":
            return self.SUPPLIER_HEADERS
        return self.WAREHOUSE_INVENTORY_HEADERS

    def _validate_row(
        self,
        tenant_id: UUID,
        import_type: ImportType,
        row: dict[str, str],
        row_number: int,
        seen_keys: set[str],
    ) -> tuple[dict[str, str | int | float | None | bool], list[ImportErrorItem], bool]:
        if import_type == "products":
            return self._validate_product_row(tenant_id, row, row_number, seen_keys)
        if import_type == "suppliers":
            return self._validate_supplier_row(tenant_id, row, row_number, seen_keys)
        return self._validate_warehouse_inventory_row(tenant_id, row, row_number, seen_keys)

    def _validate_product_row(
        self, tenant_id: UUID, row: dict[str, str], row_number: int, seen_keys: set[str]
    ):
        errors: list[ImportErrorItem] = []
        sku = row.get("sku", "").strip()
        quantity = self._parse_int(row.get("quantity"), "quantity", row_number, errors, minimum=0)
        price = self._parse_float(row.get("price"), "price", row_number, errors, minimum=0)
        existing = self.products.get_by_sku(sku) if sku else None
        duplicate = bool(existing or sku.lower() in seen_keys)
        if not row.get("product_name"):
            errors.append(
                ImportErrorItem(
                    row=row_number, field="product_name", message="Product name is required."
                )
            )
        if not sku:
            errors.append(ImportErrorItem(row=row_number, field="sku", message="SKU is required."))
        elif existing and existing.tenant_id != tenant_id:
            errors.append(
                ImportErrorItem(
                    row=row_number, field="sku", message="SKU already exists in another tenant."
                )
            )
        if sku:
            seen_keys.add(sku.lower())
        return (
            {
                "product_name": row.get("product_name") or None,
                "sku": sku or None,
                "category": row.get("category") or None,
                "brand": row.get("brand") or None,
                "quantity": quantity,
                "price": price,
                "supplier": row.get("supplier") or None,
                "warehouse_location": row.get("warehouse_location") or None,
                "description": row.get("description") or None,
                "duplicate": duplicate,
            },
            errors,
            duplicate,
        )

    def _validate_supplier_row(
        self, tenant_id: UUID, row: dict[str, str], row_number: int, seen_keys: set[str]
    ):
        errors: list[ImportErrorItem] = []
        name = row.get("name", "").strip()
        status_value = (row.get("status") or SupplierStatus.ACTIVE.value).strip().lower()
        existing = self._supplier_by_name(tenant_id, name) if name else None
        duplicate = bool(existing or name.lower() in seen_keys)
        if len(name) < 2:
            errors.append(
                ImportErrorItem(
                    row=row_number,
                    field="name",
                    message="Supplier name must be at least 2 characters.",
                )
            )
        if row.get("contact_email") and "@" not in row["contact_email"]:
            errors.append(
                ImportErrorItem(
                    row=row_number,
                    field="contact_email",
                    message="Contact email must be a valid email address.",
                )
            )
        if status_value not in {SupplierStatus.ACTIVE.value, SupplierStatus.INACTIVE.value}:
            errors.append(
                ImportErrorItem(
                    row=row_number, field="status", message="Status must be active or inactive."
                )
            )
        if name:
            seen_keys.add(name.lower())
        return (
            {
                "name": name or None,
                "contact_name": row.get("contact_name") or None,
                "contact_email": row.get("contact_email") or None,
                "contact_phone": row.get("contact_phone") or None,
                "address": row.get("address") or None,
                "status": status_value,
                "notes": row.get("notes") or None,
                "duplicate": duplicate,
            },
            errors,
            duplicate,
        )

    def _validate_warehouse_inventory_row(
        self, tenant_id: UUID, row: dict[str, str], row_number: int, seen_keys: set[str]
    ):
        errors: list[ImportErrorItem] = []
        warehouse_code = row.get("warehouse_code", "").strip().upper()
        sku = row.get("sku", "").strip()
        quantity = self._parse_int(row.get("quantity"), "quantity", row_number, errors, minimum=0)
        warehouse = (
            self.warehouses.get_by_code(tenant_id, warehouse_code) if warehouse_code else None
        )
        product = self.products.get_by_sku(sku) if sku else None
        key = f"{warehouse_code}:{sku}".lower()
        duplicate = key in seen_keys
        if not warehouse_code:
            errors.append(
                ImportErrorItem(
                    row=row_number, field="warehouse_code", message="Warehouse code is required."
                )
            )
        elif not warehouse:
            errors.append(
                ImportErrorItem(
                    row=row_number,
                    field="warehouse_code",
                    message="Warehouse code was not found for this tenant.",
                )
            )
        if not sku:
            errors.append(ImportErrorItem(row=row_number, field="sku", message="SKU is required."))
        elif not product or product.tenant_id != tenant_id:
            errors.append(
                ImportErrorItem(
                    row=row_number, field="sku", message="SKU was not found for this tenant."
                )
            )
        if warehouse and product:
            existing = self.warehouses.inventory_for_product(warehouse.id, product.id)
            duplicate = duplicate or bool(existing)
        seen_keys.add(key)
        return (
            {
                "warehouse_code": warehouse_code or None,
                "sku": sku or None,
                "quantity": quantity,
                "duplicate": duplicate,
            },
            errors,
            duplicate,
        )

    def _apply_product(
        self, tenant_id: UUID, row: dict[str, str], strategy: DuplicateStrategy
    ) -> str:
        sku = row["sku"].strip()
        existing = self.products.get_by_sku(sku)
        data = {
            "product_name": row["product_name"].strip(),
            "category": row.get("category") or None,
            "brand": row.get("brand") or None,
            "quantity": int(row.get("quantity") or 0),
            "price": self._to_float(row.get("price")),
            "supplier": row.get("supplier") or None,
            "warehouse_location": row.get("warehouse_location") or None,
            "description": row.get("description") or None,
        }
        if existing:
            if strategy == "skip":
                return "skipped"
            for key, value in data.items():
                setattr(existing, key, value)
            return "updated"
        self.db.add(Product(tenant_id=tenant_id, sku=sku, **data))
        self.db.flush()
        return "created"

    def _apply_supplier(
        self, tenant_id: UUID, row: dict[str, str], strategy: DuplicateStrategy
    ) -> str:
        name = row["name"].strip()
        existing = self._supplier_by_name(tenant_id, name)
        data = {
            "contact_name": row.get("contact_name") or None,
            "contact_email": row.get("contact_email") or None,
            "contact_phone": row.get("contact_phone") or None,
            "address": row.get("address") or None,
            "status": (row.get("status") or SupplierStatus.ACTIVE.value).strip().lower(),
            "notes": row.get("notes") or None,
        }
        if existing:
            if strategy == "skip":
                return "skipped"
            for key, value in data.items():
                setattr(existing, key, value)
            return "updated"
        self.db.add(Supplier(tenant_id=tenant_id, name=name, **data))
        self.db.flush()
        return "created"

    def _apply_warehouse_inventory(
        self, tenant_id: UUID, row: dict[str, str], strategy: DuplicateStrategy
    ) -> str:
        warehouse = self.warehouses.get_by_code(tenant_id, row["warehouse_code"].strip().upper())
        product = self.products.get_by_sku(row["sku"].strip())
        if not warehouse or not product:
            return "skipped"
        quantity = int(row.get("quantity") or 0)
        item = self.warehouses.inventory_for_product(warehouse.id, product.id)
        if item:
            if strategy == "skip":
                return "skipped"
            item.quantity = quantity
            product.quantity = self._product_total_quantity(tenant_id, product.id)
            product.warehouse_location = (
                warehouse.name if quantity > 0 else product.warehouse_location
            )
            return "updated"
        self.db.add(
            WarehouseInventory(
                tenant_id=tenant_id,
                warehouse_id=warehouse.id,
                product_id=product.id,
                quantity=quantity,
            )
        )
        self.db.flush()
        product.quantity = self._product_total_quantity(tenant_id, product.id)
        if quantity > 0:
            product.warehouse_location = warehouse.name
        return "created"

    def _supplier_by_name(self, tenant_id: UUID, name: str) -> Supplier | None:
        return (
            self.db.query(Supplier)
            .filter(Supplier.tenant_id == tenant_id, Supplier.name.ilike(name))
            .one_or_none()
        )

    def _product_total_quantity(self, tenant_id: UUID, product_id: UUID) -> int:
        return sum(
            item.quantity
            for item in self.warehouses.list_inventory(tenant_id)
            if item.product_id == product_id
        )

    def _parse_int(
        self,
        value: str | None,
        field: str,
        row_number: int,
        errors: list[ImportErrorItem],
        minimum: int | None = None,
    ) -> int:
        try:
            parsed = int(value or 0)
        except ValueError:
            errors.append(
                ImportErrorItem(
                    row=row_number, field=field, message=f"{field} must be a whole number."
                )
            )
            return 0
        if minimum is not None and parsed < minimum:
            errors.append(
                ImportErrorItem(
                    row=row_number, field=field, message=f"{field} must be at least {minimum}."
                )
            )
        return parsed

    def _parse_float(
        self,
        value: str | None,
        field: str,
        row_number: int,
        errors: list[ImportErrorItem],
        minimum: float | None = None,
    ) -> float | None:
        if value in (None, ""):
            return None
        try:
            parsed = float(value)
        except ValueError:
            errors.append(
                ImportErrorItem(row=row_number, field=field, message=f"{field} must be a number.")
            )
            return None
        if minimum is not None and parsed < minimum:
            errors.append(
                ImportErrorItem(
                    row=row_number, field=field, message=f"{field} must be at least {minimum}."
                )
            )
        return parsed

    def _to_float(self, value: str | None) -> float | None:
        if value in (None, ""):
            return None
        return float(value)
