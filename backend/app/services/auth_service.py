import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.tenant_repository import TenantRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, LoginRequest, RegisterPendingVerificationResponse, RegisterRequest
from app.services.email_service import EmailConfigurationError, EmailDeliveryError
from app.services.email_verification_service import EmailVerificationService


logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tenants = TenantRepository(db)

    def register(self, payload: RegisterRequest) -> AuthResponse | RegisterPendingVerificationResponse:
        normalized_email = payload.email.lower()
        existing = self.users.get_by_email(normalized_email)
        if existing and existing.is_email_verified:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

        if existing:
            user = existing
            user.name = payload.name
            user.password_hash = hash_password(payload.password)
            user.is_active = False
            user.is_email_verified = False

            if user.tenant_id:
                tenant = self.tenants.get_by_id(user.tenant_id)
                if tenant:
                    tenant.company_name = payload.company_name
                    tenant.contact_email = normalized_email
            else:
                tenant = self.tenants.create(company_name=payload.company_name, contact_email=normalized_email)
                user.tenant_id = tenant.id
        else:
            tenant = self.tenants.create(company_name=payload.company_name, contact_email=normalized_email)
            user = self.users.create(
                name=payload.name,
                email=normalized_email,
                password_hash=hash_password(payload.password),
                tenant_id=tenant.id,
                is_active=False,
            )

        verification = EmailVerificationService(self.db)
        try:
            verification.issue_signup_otp(user=user, reset_resend_limit=True)
        except (EmailConfigurationError, EmailDeliveryError) as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Verification email could not be sent.",
            ) from exc

        self.db.commit()
        self.db.refresh(user)

        return RegisterPendingVerificationResponse(email=user.email)

    def login(self, payload: LoginRequest) -> AuthResponse:
        user = self.users.get_by_email(payload.email.lower())
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is inactive.",
            )
        if not user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Verify your email before signing in.",
            )

        return self.auth_response_for_user(user)

    def google_login(self, *, email: str) -> AuthResponse:
        normalized_email = email.lower()
        user = self.users.get_by_email(normalized_email)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found. Please sign up first.")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is inactive.")
        if not user.is_email_verified:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify your email before signing in.")
        return self.auth_response_for_user(user)

    @staticmethod
    def auth_response_for_user(user) -> AuthResponse:
        token = create_access_token(
            str(user.id),
            {"tenant_id": str(user.tenant_id) if user.tenant_id else None, "role": user.role.value},
        )
        return AuthResponse(access_token=token, user=user)
