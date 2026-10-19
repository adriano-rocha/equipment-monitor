"""Autenticação de usuários por e-mail e senha, com emissão de JWT."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.infrastructure.config import get_settings


class InvalidUserCredentialsError(Exception):
    """Credenciais de usuário inválidas."""


class UserAuthService:
    def __init__(self, password_hasher: PasswordHasher | None = None) -> None:
        self._password_hasher = password_hasher or PasswordHasher()
        self._settings = get_settings()

    def hash_password(self, password: str) -> str:
        return self._password_hasher.hash(password)

    def verify_password(self, password_hash: str, password: str) -> bool:
        try:
            return self._password_hasher.verify(password_hash, password)
        except (VerifyMismatchError, InvalidHashError):
            return False

    def create_access_token(self, user_id: UUID) -> str:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self._settings.jwt_expire_minutes)

        return jwt.encode(
            {
                "sub": str(user_id),
                "iat": now,
                "exp": expires_at,
            },
            self._settings.jwt_secret_key,
            algorithm=self._settings.jwt_algorithm,
        )

    def decode_access_token(self, token: str) -> UUID:
        try:
            payload = jwt.decode(
                token,
                self._settings.jwt_secret_key,
                algorithms=[self._settings.jwt_algorithm],
            )
            return UUID(payload["sub"])
        except (jwt.InvalidTokenError, ValueError, KeyError, TypeError) as exc:
            raise InvalidUserCredentialsError() from exc