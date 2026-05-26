from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.tenant_repository import TenantRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tenants = TenantRepository(db)

    def register(self, payload: RegisterRequest) -> AuthResponse:
        normalized_email = payload.email.lower()
        if self.users.get_by_email(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

        tenant = self.tenants.create(
            company_name=payload.company_name,
            contact_email=normalized_email,
        )
        user = self.users.create(
            name=payload.name,
            email=normalized_email,
            password_hash=hash_password(payload.password),
            tenant_id=tenant.id,
        )
        self.db.commit()
        self.db.refresh(user)
        token = create_access_token(
            str(user.id),
            {"tenant_id": str(user.tenant_id), "role": user.role.value},
        )
        return AuthResponse(access_token=token, user=user)

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

        token = create_access_token(
            str(user.id),
            {"tenant_id": str(user.tenant_id) if user.tenant_id else None, "role": user.role.value},
        )
        return AuthResponse(access_token=token, user=user)
