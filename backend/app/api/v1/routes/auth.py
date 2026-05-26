from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthUser,
    ForgotPasswordRequest,
    LoginRequest,
    PasswordResetMessage,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyResetOTPRequest,
)
from app.schemas.common import ApiResponse
from app.services.auth_service import AuthService
from app.services.password_reset_service import GENERIC_RESET_MESSAGE, PasswordResetService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> ApiResponse:
    auth = AuthService(db).register(payload)
    return ApiResponse(message="Account created successfully.", data=auth.model_dump(mode="json"))


@router.post("/login", response_model=ApiResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> ApiResponse:
    auth = AuthService(db).login(payload)
    return ApiResponse(message="Login successful.", data=auth.model_dump(mode="json"))


@router.post("/forgot-password", response_model=ApiResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ApiResponse:
    PasswordResetService(db).request_reset(payload)
    return ApiResponse(message=GENERIC_RESET_MESSAGE, data=PasswordResetMessage().model_dump())


@router.post("/verify-reset-otp", response_model=ApiResponse)
def verify_reset_otp(payload: VerifyResetOTPRequest, db: Session = Depends(get_db)) -> ApiResponse:
    result = PasswordResetService(db).verify_otp(payload)
    return ApiResponse(message="Reset code verified successfully.", data=result.model_dump())


@router.post("/reset-password", response_model=ApiResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> ApiResponse:
    PasswordResetService(db).reset_password(payload)
    return ApiResponse(message="Password reset successfully.", data=PasswordResetMessage().model_dump())


@router.get("/me", response_model=ApiResponse)
def me(current_user: User = Depends(get_current_user)) -> ApiResponse:
    user = AuthUser.model_validate(current_user)
    return ApiResponse(message="Current user fetched successfully.", data=user.model_dump(mode="json"))
