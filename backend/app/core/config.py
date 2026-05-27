from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    project_name: str = "Inventory Management System"
    version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(
        default="postgresql+psycopg://postgres:123@localhost:5432/inventory",
        alias="DATABASE_URL",
    )
    backend_cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="BACKEND_CORS_ORIGINS",
    )
    jwt_secret_key: str = Field(default="dev-secret-change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=60,
        alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: str | None = Field(default=None, alias="SMTP_FROM_EMAIL")
    email: str | None = Field(default=None, alias="EMAIL")
    email_secret_code: str | None = Field(default=None, alias="EMAIL_SECRET_CODE")
    google_client_id: str | None = Field(default=None, alias="GOOGLE_CLIENT_ID")
    google_client_secret: str | None = Field(default=None, alias="GOOGLE_CLIENT_SECRET")
    password_reset_otp_expire_minutes: int = Field(default=10, alias="PASSWORD_RESET_OTP_EXPIRE_MINUTES")
    password_reset_resend_cooldown_seconds: int = Field(default=60, alias="PASSWORD_RESET_RESEND_COOLDOWN_SECONDS")
    password_reset_max_attempts: int = Field(default=5, alias="PASSWORD_RESET_MAX_ATTEMPTS")
    email_verification_otp_expire_minutes: int = Field(default=10, alias="EMAIL_VERIFICATION_OTP_EXPIRE_MINUTES")
    email_verification_resend_cooldown_seconds: int = Field(default=30, alias="EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS")
    email_verification_max_attempts: int = Field(default=5, alias="EMAIL_VERIFICATION_MAX_ATTEMPTS")
    email_verification_max_resends: int = Field(default=3, alias="EMAIL_VERIFICATION_MAX_RESENDS")

    @property
    def backend_cors_origins(self) -> list[str]:
        return [
            origin
            for origin in (origin.strip() for origin in self.backend_cors_origins_raw.split(","))
            if origin
        ]

    @property
    def smtp_host_effective(self) -> str | None:
        if self.smtp_host:
            return self.smtp_host
        if self.email:
            return "smtp.gmail.com"
        return None

    @property
    def smtp_username_effective(self) -> str | None:
        return self.smtp_username or self.email

    @property
    def smtp_password_effective(self) -> str | None:
        value = self.smtp_password or self.email_secret_code
        if not value:
            return None
        return value.replace(" ", "")

    @property
    def smtp_from_email_effective(self) -> str | None:
        return self.smtp_from_email or self.email

    @property
    def smtp_configured(self) -> bool:
        return all(
            [
                self.smtp_host_effective,
                self.smtp_username_effective,
                self.smtp_password_effective,
                self.smtp_from_email_effective,
            ]
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
