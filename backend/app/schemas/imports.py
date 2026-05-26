from typing import Literal

from pydantic import BaseModel, Field

ImportType = Literal["products", "suppliers", "warehouse_inventory"]
DuplicateStrategy = Literal["skip", "update"]


class ImportErrorItem(BaseModel):
    row: int
    field: str | None = None
    message: str


class ImportPreview(BaseModel):
    import_type: ImportType
    total_rows: int
    valid_rows: int
    duplicate_rows: int
    error_rows: int
    headers: list[str]
    rows: list[dict[str, str | int | float | None | bool]]
    errors: list[ImportErrorItem] = []


class ImportApplyResult(BaseModel):
    import_type: ImportType
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[ImportErrorItem] = []


class ImportTemplate(BaseModel):
    label: str
    href: str
    import_type: ImportType
    description: str


class ImportTemplateList(BaseModel):
    templates: list[ImportTemplate] = Field(default_factory=list)
