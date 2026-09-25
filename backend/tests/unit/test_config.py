"""Testes de smoke para app.infrastructure.config.

Comprovam que:
- Settings lê variáveis de ambiente obrigatórias (database_url, jwt_secret_key).
- Valores padrão de heartbeat/threshold (ADR-003) são aplicados quando não
  sobrescritos.
"""

import pytest
from pydantic import ValidationError

from app.infrastructure.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    """get_settings() é cacheado (lru_cache) — limpa entre testes."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_load_required_vars_from_env(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://equipment_monitor:changeme@localhost:5432/equipment_monitor",
    )
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")

    settings = get_settings()

    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.jwt_secret_key == "test-secret"


def test_settings_default_heartbeat_thresholds(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@localhost:5432/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")

    settings = get_settings()

    assert settings.heartbeat_interval_seconds == 30
    assert settings.offline_threshold_seconds == 90


def test_settings_missing_required_var_raises(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(ValidationError):
        get_settings()