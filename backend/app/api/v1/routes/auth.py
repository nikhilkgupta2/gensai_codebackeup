from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthUser,
    ForgotPasswordRequest,
    GoogleClientIdResponse,
    GoogleIdTokenRequest,
    GoogleLoginRequest,
    LoginRequest,
    PasswordResetMessage,
    RegisterRequest,
    ResendEmailOTPRequest,
    ResetPasswordRequest,
    UpdateMeRequest,
    VerifyEmailOTPRequest,
    VerifyResetOTPRequest,
)
from app.schemas.common import ApiResponse
from app.services.auth_service import AuthService
from app.services.email_verification_service import EmailVerificationService
from app.services.google_auth_service import GoogleAuthService
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

@router.post("/google-login", response_model=ApiResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)) -> ApiResponse:
    auth = AuthService(db).google_login(email=str(payload.email))
    return ApiResponse(message="Login successful.", data=auth.model_dump(mode="json"))

@router.get("/google-client-id", response_model=ApiResponse)
def google_client_id() -> ApiResponse:
    client_id = GoogleAuthService().client_id()
    return ApiResponse(message="Google client id fetched.", data=GoogleClientIdResponse(client_id=client_id).model_dump())


@router.post("/google-verify", response_model=ApiResponse)
def google_verify(payload: GoogleIdTokenRequest, db: Session = Depends(get_db)) -> ApiResponse:
    google_payload = GoogleAuthService().verify_id_token(payload.credential)
    email = google_payload.get("email")
    if not email:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google credential did not include email.")
    auth = AuthService(db).google_login(email=str(email))
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


@router.post("/verify-email-otp", response_model=ApiResponse)
def verify_email_otp(payload: VerifyEmailOTPRequest, db: Session = Depends(get_db)) -> ApiResponse:
    user = EmailVerificationService(db).verify_otp(email=str(payload.email), otp=payload.otp)
    auth = AuthService(db).auth_response_for_user(user)
    return ApiResponse(message="Email verified successfully.", data=auth.model_dump(mode="json"))


@router.post("/resend-email-otp", response_model=ApiResponse)
def resend_email_otp(payload: ResendEmailOTPRequest, db: Session = Depends(get_db)) -> ApiResponse:
    EmailVerificationService(db).request_otp(email=str(payload.email))
    return ApiResponse(message="Verification code sent.", data=PasswordResetMessage().model_dump())


@router.get("/me", response_model=ApiResponse)
def me(current_user: User = Depends(get_current_user)) -> ApiResponse:
    user = AuthUser.model_validate(current_user)
    return ApiResponse(message="Current user fetched successfully.", data=user.model_dump(mode="json"))


@router.put("/me", response_model=ApiResponse)
def update_me(
    payload: UpdateMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse:
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        current_user.name = data["name"]
    if data.get("company_name") is not None:
        if current_user.tenant is None:
            from fastapi import HTTPException

            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company updates require a tenant user.")
        current_user.tenant.company_name = data["company_name"]
    if data.get("password"):
        from app.core.security import hash_password

        current_user.password_hash = hash_password(data["password"])

    db.commit()
    db.refresh(current_user)
    user = AuthUser.model_validate(current_user)
    return ApiResponse(message="Profile updated successfully.", data=user.model_dump(mode="json"))
