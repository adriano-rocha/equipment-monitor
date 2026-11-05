"""Configuração da aplicação via variáveis de ambiente (pydantic-settings).

🔑 palavra-chave: Settings é lido UMA vez e cacheado (get_settings()) — evita
reler o .env a cada chamada e permite override fácil em testes via
get_settings.cache_clear() + monkeypatch.setenv(...).

🔑 palavra-chave: REPO_ROOT — o .env real vive na raiz do repositório (ao lado
do docker-compose.yml), não em backend/. Resolvendo o caminho a partir de
__file__ (em vez de um "./.env" relativo ao CWD), o config funciona igual
rodando de backend/, da raiz, via alembic ou via pytest. Dentro do container
Docker esse caminho simplesmente não existe — e está tudo bem: nesse caso as
variáveis já chegam como variáveis de ambiente reais (via env_file/environment
do docker-compose), e o pydantic-settings usa essas diretamente.
"""

from functools import lru_cache
from pathlib import Path
from pydantic import field_validator

from pydantic_settings import BaseSettings, SettingsConfigDict

_MIN_JWT_SECRET_LENGTH = 32
_FORBIDDEN_JWT_SECRETS = {"changeme", "secret", "test-secret"}
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Espelha as variáveis definidas em .env.example (raiz do repositório)."""

    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PostgreSQL
    database_url: str

    # JWT (usuários do dashboard)
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Heartbeat (ADR-003)
    heartbeat_interval_seconds: int = 30
    offline_threshold_seconds: int = 90

    # Telegram (Phase 05)
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret_strength(cls, value: str) -> str:
        if value.strip().lower() in _FORBIDDEN_JWT_SECRETS:
            raise ValueError("JWT_SECRET_KEY usa um valor padrão inseguro.")
        if len(value) < _MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET_KEY deve ter pelo menos {_MIN_JWT_SECRET_LENGTH} caracteres."
            )
        return value


@lru_cache
def get_settings() -> Settings:
    """Ponto único de acesso às configurações (cacheado)."""
    return Settings()

@field_validator