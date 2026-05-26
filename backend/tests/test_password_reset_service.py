from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.enums import TenantStatus, UserRole
from app.core.otp import verify_reset_secret
from app.core.security import hash_password, verify_password
from app.db.base import Base
from app.models.password_reset import PasswordResetOTP
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest, VerifyResetOTPRequest
from app.services.password_reset_service import PasswordResetService


class FakeEmailService:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    def send_password_reset_otp(self, *, to_email: str, otp: str) -> None:
        self.messages.append((to_email, otp))


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def active_user(db):
    tenant = Tenant(
        company_name="Acme Retail",
        contact_email="owner@example.com",
        status=TenantStatus.ACTIVE,
    )
    user = User(
        tenant=tenant,
        name="Acme Owner",
        email="owner@example.com",
        password_hash=hash_password("OldPassword123"),
        role=UserRole.RETAILER_ADMIN,
        is_active=True,
    )
    db.add_all([tenant, user])
    db.commit()
    db.refresh(user)
    return user


def latest_reset(db) -> PasswordResetOTP:
    return db.query(PasswordResetOTP).order_by(PasswordResetOTP.created_at.desc()).first()


def test_forgot_password_sends_hashed_otp(db, active_user):
    email = FakeEmailService()

    PasswordResetService(db, email).request_reset(ForgotPasswordRequest(email=active_user.email))

    reset = latest_reset(db)
    assert reset is not None
    assert reset.otp_hash != email.messages[0][1]
    assert verify_reset_secret(email.messages[0][1], reset.otp_hash)
    assert email.messages[0][0] == active_user.email


def test_forgot_password_respects_resend_cooldown(db, active_user):
    email = FakeEmailService()
    service = PasswordResetService(db, email)

    service.request_reset(ForgotPasswordRequest(email=active_user.email))
    service.request_reset(ForgotPasswordRequest(email=active_user.email))

    assert len(email.messages) == 1
    assert db.query(PasswordResetOTP).filter(PasswordResetOTP.is_used.is_(False)).count() == 1


def test_verify_rejects_invalid_otp(db, active_user):
    email = FakeEmailService()
    service = PasswordResetService(db, email)
    service.request_reset(ForgotPasswordRequest(email=active_user.email))

    with pytest.raises(HTTPException) as exc:
        service.verify_otp(VerifyResetOTPRequest(email=active_user.email, otp="000000"))

    assert exc.value.status_code == 400
    assert latest_reset(db).attempts == 1


def test_verify_rejects_expired_otp(db, active_user):
    email = FakeEmailService()
    service = PasswordResetService(db, email)
    service.request_reset(ForgotPasswordRequest(email=active_user.email))
    reset = latest_reset(db)
    reset.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        service.verify_otp(VerifyResetOTPRequest(email=active_user.email, otp=email.messages[0][1]))

    assert exc.value.status_code == 400


def test_successful_reset_invalidates_otp_and_changes_password(db, active_user):
    email = FakeEmailService()
    service = PasswordResetService(db, email)
    service.request_reset(ForgotPasswordRequest(email=active_user.email))
    verified = service.verify_otp(VerifyResetOTPRequest(email=active_user.email, otp=email.messages[0][1]))

    service.reset_password(
        ResetPasswordRequest(
            email=active_user.email,
            reset_token=verified.reset_token,
            new_password="NewPassword123",
        ),
    )

    db.refresh(active_user)
    reset = latest_reset(db)
    assert reset.is_used is True
    assert reset.used_at is not None
    assert verify_password("NewPassword123", active_user.password_hash)
