"""Configuração da aplicação via variáveis de ambiente (pydantic-settings).

🔑 palavra-chave: Settings é lido UMA vez e cacheado (get_settings()) — evita
reler o .env a cada chamada e permite override fácil em testes via
get_settings.cache_clear() + monkeypatch.setenv(...).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Espelha as variáveis definidas em .env.example (raiz do repositório)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PostgreSQL
    database_url: str

    # JWT (usuários do dashboard — não usado nesta spec, mas já configurável)
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Heartbeat (ADR-003)
    heartbeat_interval_seconds: int = 30
    offline_threshold_seconds: int = 90


@lru_cache
def get_settings() -> Settings:
    """Ponto único de acesso às configurações (cacheado)."""
    return Settings()