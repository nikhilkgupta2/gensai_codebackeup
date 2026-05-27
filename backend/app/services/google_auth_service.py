from fastapi import HTTPException, status

from app.core.config import settings


class GoogleAuthService:
    def client_id(self) -> str:
        if not settings.google_client_id:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google login is not configured.")
        return settings.google_client_id

    def verify_id_token(self, credential: str) -> dict:
        if not settings.google_client_id:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google login is not configured.")

        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import id_token
        except Exception as exc:  # pragma: no cover
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google login dependencies are missing. Install google-auth.",
            ) from exc

        try:
            payload = id_token.verify_oauth2_token(credential, Request(), settings.google_client_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential.") from exc

        if payload.get("aud") != settings.google_client_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google audience.")

        return payload

