from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.enums import UserRole


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    company_name: str = Field(min_length=2, max_length=160)

class RegisterPendingVerificationResponse(BaseModel):
    pending_verification: bool = True
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class GoogleLoginRequest(BaseModel):
    email: EmailStr

class GoogleIdTokenRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)

class GoogleClientIdResponse(BaseModel):
    client_id: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")

class VerifyEmailOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")

class ResendEmailOTPRequest(BaseModel):
    email: EmailStr


class VerifyResetOTPResponse(BaseModel):
    reset_token: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str = Field(min_length=32, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetMessage(BaseModel):
    accepted: bool = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthUser(BaseModel):
    id: UUID
    tenant_id: UUID | None
    name: str
    email: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    assigned_warehouse: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser
