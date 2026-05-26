from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_tenant_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.imports import DuplicateStrategy, ImportTemplate, ImportTemplateList, ImportType
from app.services.import_service import CsvImportService

router = APIRouter(prefix="/imports", tags=["imports"])
DbSession = Annotated[Session, Depends(get_db)]
ImportManager = Annotated[User, Depends(require_tenant_roles(UserRole.RETAILER_ADMIN))]
CsvUpload = Annotated[UploadFile, File(...)]
DuplicateStrategyForm = Annotated[DuplicateStrategy, Form()]


@router.get("/templates", response_model=ApiResponse)
def list_import_templates(current_user: ImportManager) -> ApiResponse:
    _ = current_user
    templates = ImportTemplateList(
        templates=[
            ImportTemplate(
                label="Products template",
                href="/samples/products-template.csv",
                import_type="products",
                description="Required product columns for a clean inventory import.",
            ),
            ImportTemplate(
                label="Suppliers template",
                href="/samples/suppliers-template.csv",
                import_type="suppliers",
                description="Supplier profile and contact columns.",
            ),
            ImportTemplate(
                label="Warehouse inventory template",
                href="/samples/warehouse-inventory-template.csv",
                import_type="warehouse_inventory",
                description="Assign existing SKUs to existing warehouse codes.",
            ),
            ImportTemplate(
                label="Electronics retailer dataset",
                href="/samples/electronics-retailer-products.csv",
                import_type="products",
                description="Demo electronics product catalog.",
            ),
            ImportTemplate(
                label="Electronics supplier dataset",
                href="/samples/electronics-retailer-suppliers.csv",
                import_type="suppliers",
                description="Demo electronics supplier list.",
            ),
            ImportTemplate(
                label="Grocery retailer dataset",
                href="/samples/grocery-retailer-products.csv",
                import_type="products",
                description="Demo grocery product catalog.",
            ),
            ImportTemplate(
                label="Grocery supplier dataset",
                href="/samples/grocery-retailer-suppliers.csv",
                import_type="suppliers",
                description="Demo grocery supplier list.",
            ),
            ImportTemplate(
                label="Clothing retailer dataset",
                href="/samples/clothing-retailer-products.csv",
                import_type="products",
                description="Demo apparel product catalog.",
            ),
            ImportTemplate(
                label="Clothing supplier dataset",
                href="/samples/clothing-retailer-suppliers.csv",
                import_type="suppliers",
                description="Demo apparel supplier list.",
            ),
            ImportTemplate(
                label="Demo warehouse inventory dataset",
                href="/samples/demo-warehouse-inventory.csv",
                import_type="warehouse_inventory",
                description=(
                    "Example warehouse stock assignments for existing warehouse codes and SKUs."
                ),
            ),
        ]
    )
    return ApiResponse(
        message="Import templates fetched successfully.",
        data=templates.model_dump(mode="json"),
    )


@router.post("/{import_type}/preview", response_model=ApiResponse)
async def preview_import(
    import_type: ImportType,
    db: DbSession,
    current_user: ImportManager,
    file: CsvUpload,
) -> ApiResponse:
    contents = await file.read()
    preview = CsvImportService(db).preview(current_user.tenant_id, import_type, contents)
    return ApiResponse(
        message="CSV preview generated successfully.",
        data=preview.model_dump(mode="json"),
    )


@router.post(
    "/{import_type}/apply",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_import(
    import_type: ImportType,
    db: DbSession,
    current_user: ImportManager,
    file: CsvUpload,
    duplicate_strategy: DuplicateStrategyForm = "skip",
) -> ApiResponse:
    contents = await file.read()
    result = CsvImportService(db).apply(
        current_user.tenant_id,
        import_type,
        contents,
        duplicate_strategy,
    )
    if not result.errors:
        db.commit()
    return ApiResponse(
        message="CSV import processed successfully.",
        data=result.model_dump(mode="json"),
    )
