from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.enums import UserRole
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])
DbSession = Annotated[Session, Depends(get_db)]
UserManager = Annotated[
    User,
    Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.RETAILER_ADMIN)),
]
SearchQuery = Annotated[str | None, Query(max_length=255)]
RoleQuery = Annotated[UserRole | None, Query()]
ActiveQuery = Annotated[bool | None, Query()]
PageQuery = Annotated[int, Query(ge=1)]
LimitQuery = Annotated[int, Query(ge=1, le=100)]


def _user_data(user: User) -> dict:
    return UserOut.model_validate(user).model_dump(mode="json")


@router.get("", response_model=ApiResponse)
def list_users(
    db: DbSession,
    current_user: UserManager,
    search: SearchQuery = None,
    role: RoleQuery = None,
    is_active: ActiveQuery = None,
    page: PageQuery = 1,
    limit: LimitQuery = 20,
) -> ApiResponse:
    service = UserService(db)
    offset = (page - 1) * limit
    users = service.list(
        current_user=current_user,
        search=search,
        role=role,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
    total = service.count(
        current_user=current_user,
        search=search,
        role=role,
        is_active=is_active,
    )
    return ApiResponse(
        message="Users fetched successfully.",
        data=[_user_data(user) for user in users],
        pagination={"page": page, "limit": limit, "total": total},
    )


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession, current_user: UserManager) -> ApiResponse:
    service = UserService(db)
    user = service.create(current_user=current_user, payload=payload)
    db.commit()
    db.refresh(user)
    return ApiResponse(message="User created successfully.", data=_user_data(user))


@router.get("/{user_id}", response_model=ApiResponse)
def get_user(user_id: UUID, db: DbSession, current_user: UserManager) -> ApiResponse:
    user = UserService(db).get_visible(current_user=current_user, user_id=user_id)
    return ApiResponse(message="User fetched successfully.", data=_user_data(user))


@router.put("/{user_id}", response_model=ApiResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: DbSession,
    current_user: UserManager,
) -> ApiResponse:
    service = UserService(db)
    user = service.update(current_user=current_user, user_id=user_id, payload=payload)
    db.commit()
    db.refresh(user)
    return ApiResponse(message="User updated successfully.", data=_user_data(user))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: UUID, db: DbSession, current_user: UserManager) -> None:
    UserService(db).delete(current_user=current_user, user_id=user_id)
    db.commit()
    return None
