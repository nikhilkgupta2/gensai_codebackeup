import hmac
import secrets
from hashlib import sha256

from app.core.config import settings


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_reset_secret(value: str) -> str:
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        value.encode("utf-8"),
        sha256,
    ).hexdigest()


def verify_reset_secret(value: str, hashed_value: str) -> bool:
    return hmac.compare_digest(hash_reset_secret(value), hashed_value)
