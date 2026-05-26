from typing import Any

from pydantic import BaseModel


class ApiResponse(BaseModel):
    success: bool = True
    message: str
    data: Any | None = None
    pagination: dict[str, int] | None = None
