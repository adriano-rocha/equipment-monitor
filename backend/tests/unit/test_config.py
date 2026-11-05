"""Testes de smoke para app.infrastructure.config.

Comprovam que:
- Settings lê variáveis de ambiente obrigatórias (database_url, jwt_secret_key).
- Valores padrão de heartbeat/threshold (ADR-003) são aplicados quando não
  sobrescritos.
- jwt_secret_key fraco (curto ou padrão conhecido) é recusado na inicialização.
"""

import pytest
from pydantic import ValidationError

from app.infrastructure.config import Settings, get_settings

DATABASE_URL = "postgresql+psycopg://u:p@localhost:5432/db"

# Segredo fictício apenas para testes: 48 caracteres, acima do mínimo de 32.
VALID_JWT_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-chars"


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
    monkeypatch.setenv("JWT_SECRET_KEY", VALID_JWT_SECRET)

    settings = get_settings()

    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.jwt_secret_key == VALID_JWT_SECRET


def test_settings_default_heartbeat_thresholds(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL)
    monkeypatch.setenv("JWT_SECRET_KEY", VALID_JWT_SECRET)

    settings = get_settings()

    assert settings.heartbeat_interval_seconds == 30
    assert settings.offline_threshold_seconds == 90


def test_settings_missing_required_var_raises(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    # _env_file=None isola este teste do .env real do projeto — sem isso, o
    # teste passaria a ler os valores reais do .env em vez de simular ausência.
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_rejects_short_jwt_secret(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL)
    monkeypatch.setenv("JWT_SECRET_KEY", "curto")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_rejects_default_jwt_secret(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL)
    monkeypatch.setenv("JWT_SECRET_KEY", "changeme")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_jwt_secret_length_boundary(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL)

    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 31)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)

    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    assert Settings(_env_file=None).jwt_secret_key == "x" * 32