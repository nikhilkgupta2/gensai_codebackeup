from datetime import UTC, datetime, timedelta
import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.otp import generate_otp, hash_reset_secret, verify_reset_secret
from app.models.email_verification import EmailVerificationOTP
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.email_service import EmailConfigurationError, EmailDeliveryError, EmailService


logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class EmailVerificationService:
    def __init__(self, db: Session, email_service: EmailService | None = None) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.email_service = email_service or EmailService()

    def request_otp(self, *, email: str) -> None:
        normalized_email = email.lower()
        user = self.users.get_by_email(normalized_email)
        if user is None or user.is_email_verified:
            return

        now = utc_now()
        record = self._latest_active_for_user(user)
        if record and as_aware(record.resend_available_at) > now:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Please wait before resending.")

        if record and record.resend_count >= settings.email_verification_max_resends:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Resend limit reached. Try again later.",
            )

        otp = generate_otp()
        if record is None:
            record = EmailVerificationOTP(
                user_id=user.id,
                email=normalized_email,
                otp_hash=hash_reset_secret(otp),
                expires_at=now + timedelta(minutes=settings.email_verification_otp_expire_minutes),
                resend_available_at=now + timedelta(seconds=settings.email_verification_resend_cooldown_seconds),
                resend_count=0,
                attempts=0,
                is_used=False,
            )
            self.db.add(record)
        else:
            record.otp_hash = hash_reset_secret(otp)
            record.expires_at = now + timedelta(minutes=settings.email_verification_otp_expire_minutes)
            record.resend_available_at = now + timedelta(seconds=settings.email_verification_resend_cooldown_seconds)
            record.resend_count += 1
            record.attempts = 0
            record.is_used = False
            record.used_at = None

        if not settings.smtp_configured:
            logger.warning(
                "SMTP is not configured; email verification OTP for %s is %s",
                normalized_email,
                otp,
            )
            self.db.commit()
            return

        try:
            self.email_service.send_email_verification_otp(to_email=normalized_email, otp=otp)
        except EmailConfigurationError as exc:
            self.db.rollback()
            logger.warning("Email verification skipped because SMTP is not configured: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Verification email is not configured.",
            ) from exc
        except EmailDeliveryError as exc:
            self.db.rollback()
            logger.warning("Email verification delivery failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Verification email could not be sent.",
            ) from exc

        self.db.commit()

    def verify_otp(self, *, email: str, otp: str) -> User:
        normalized_email = email.lower()
        record = self._latest_active_for_email(normalized_email)
        now = utc_now()
        if record is None or as_aware(record.expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")

        if record.attempts >= settings.email_verification_max_attempts:
            record.is_used = True
            record.used_at = now
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")

        if not verify_reset_secret(otp, record.otp_hash):
            record.attempts += 1
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")

        user = record.user
        if user is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code.")

        user.is_email_verified = True
        user.is_active = True
        record.is_used = True
        record.used_at = now
        self.db.commit()
        self.db.refresh(user)
        return user

    def issue_signup_otp(self, *, user: User, reset_resend_limit: bool = False) -> None:
        now = utc_now()
        record = self._latest_active_for_user(user)
        otp = generate_otp()
        if record is None:
            record = EmailVerificationOTP(
                user_id=user.id,
                email=user.email,
                otp_hash=hash_reset_secret(otp),
                expires_at=now + timedelta(minutes=settings.email_verification_otp_expire_minutes),
                resend_available_at=now + timedelta(seconds=settings.email_verification_resend_cooldown_seconds),
                resend_count=0,
                attempts=0,
                is_used=False,
            )
            self.db.add(record)
        else:
            record.otp_hash = hash_reset_secret(otp)
            record.expires_at = now + timedelta(minutes=settings.email_verification_otp_expire_minutes)
            record.resend_available_at = now + timedelta(seconds=settings.email_verification_resend_cooldown_seconds)
            record.attempts = 0
            record.is_used = False
            record.used_at = None
            if reset_resend_limit:
                record.resend_count = 0

        if not settings.smtp_configured:
            logger.warning("SMTP is not configured; email verification OTP for %s is %s", user.email, otp)
            return

        self.email_service.send_email_verification_otp(to_email=user.email, otp=otp)

    def _latest_active_for_user(self, user: User) -> EmailVerificationOTP | None:
        return (
            self.db.query(EmailVerificationOTP)
            .filter(EmailVerificationOTP.user_id == user.id, EmailVerificationOTP.is_used.is_(False))
            .order_by(EmailVerificationOTP.created_at.desc())
            .first()
        )

    def _latest_active_for_email(self, email: str) -> EmailVerificationOTP | None:
        return (
            self.db.query(EmailVerificationOTP)
            .filter(EmailVerificationOTP.email == email, EmailVerificationOTP.is_used.is_(False))
            .order_by(EmailVerificationOTP.created_at.desc())
            .first()
        )

    def _invalidate_active_for_user(self, user: User, *, used_at: datetime) -> None:
        (
            self.db.query(EmailVerificationOTP)
            .filter(EmailVerificationOTP.user_id == user.id, EmailVerificationOTP.is_used.is_(False))
            .update({"is_used": True, "used_at": used_at}, synchronize_session=False)
        )
