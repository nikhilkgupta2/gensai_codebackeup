from datetime import UTC, datetime, timedelta
import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.otp import generate_otp, generate_reset_token, hash_reset_secret, verify_reset_secret
from app.core.security import hash_password
from app.models.password_reset import PasswordResetOTP
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest, VerifyResetOTPRequest, VerifyResetOTPResponse
from app.services.email_service import EmailConfigurationError, EmailDeliveryError, EmailService


GENERIC_RESET_MESSAGE = "If an account exists for this email, a reset code will be sent."
logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class PasswordResetService:
    def __init__(self, db: Session, email_service: EmailService | None = None) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.email_service = email_service or EmailService()

    def request_reset(self, payload: ForgotPasswordRequest) -> None:
        normalized_email = payload.email.lower()
        user = self.users.get_by_email(normalized_email)
        if user is None or not user.is_active:
            return

        now = utc_now()
        latest = self._latest_active_for_user(user)
        if latest and as_aware(latest.resend_available_at) > now:
            return

        self._invalidate_active_for_user(user, used_at=now)
        otp = generate_otp()
        reset_otp = PasswordResetOTP(
            user_id=user.id,
            email=normalized_email,
            otp_hash=hash_reset_secret(otp),
            expires_at=now + timedelta(minutes=settings.password_reset_otp_expire_minutes),
            resend_available_at=now + timedelta(seconds=settings.password_reset_resend_cooldown_seconds),
            attempts=0,
            is_used=False,
        )
        self.db.add(reset_otp)

        try:
            self.email_service.send_password_reset_otp(to_email=normalized_email, otp=otp)
        except EmailConfigurationError as exc:
            self.db.rollback()
            logger.warning("Password reset email skipped because SMTP is not configured: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password reset email is not configured.",
            ) from exc
        except EmailDeliveryError as exc:
            self.db.rollback()
            logger.warning("Password reset email delivery failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password reset email could not be sent.",
            ) from exc

        self.db.commit()

    def verify_otp(self, payload: VerifyResetOTPRequest) -> VerifyResetOTPResponse:
        normalized_email = payload.email.lower()
        reset_otp = self._latest_active_for_email(normalized_email)
        now = utc_now()
        if reset_otp is None or as_aware(reset_otp.expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

        if reset_otp.attempts >= settings.password_reset_max_attempts:
            reset_otp.is_used = True
            reset_otp.used_at = now
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

        if not verify_reset_secret(payload.otp, reset_otp.otp_hash):
            reset_otp.attempts += 1
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

        reset_token = generate_reset_token()
        reset_otp.reset_token_hash = hash_reset_secret(reset_token)
        self.db.commit()
        return VerifyResetOTPResponse(reset_token=reset_token)

    def reset_password(self, payload: ResetPasswordRequest) -> None:
        normalized_email = payload.email.lower()
        reset_otp = self._latest_active_for_email(normalized_email)
        now = utc_now()
        if (
            reset_otp is None
            or as_aware(reset_otp.expires_at) <= now
            or not reset_otp.reset_token_hash
            or not verify_reset_secret(payload.reset_token, reset_otp.reset_token_hash)
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset session.")

        user = reset_otp.user
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset session.")

        user.password_hash = hash_password(payload.new_password)
        reset_otp.is_used = True
        reset_otp.used_at = now
        self.db.commit()

    def _latest_active_for_user(self, user: User) -> PasswordResetOTP | None:
        return (
            self.db.query(PasswordResetOTP)
            .filter(PasswordResetOTP.user_id == user.id, PasswordResetOTP.is_used.is_(False))
            .order_by(PasswordResetOTP.created_at.desc())
            .first()
        )

    def _latest_active_for_email(self, email: str) -> PasswordResetOTP | None:
        return (
            self.db.query(PasswordResetOTP)
            .filter(PasswordResetOTP.email == email, PasswordResetOTP.is_used.is_(False))
            .order_by(PasswordResetOTP.created_at.desc())
            .first()
        )

    def _invalidate_active_for_user(self, user: User, *, used_at: datetime) -> None:
        (
            self.db.query(PasswordResetOTP)
            .filter(PasswordResetOTP.user_id == user.id, PasswordResetOTP.is_used.is_(False))
            .update({"is_used": True, "used_at": used_at}, synchronize_session=False)
        )
