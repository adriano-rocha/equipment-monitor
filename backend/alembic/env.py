import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Garante que "app" seja importável (env.py roda de dentro de backend/alembic/,
# então subimos um nível até backend/ para achar o pacote app).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.infrastructure.config import get_settings  # noqa: E402
from app.infrastructure.db.base import Base  # noqa: E402
from app.infrastructure.db import models  # noqa: E402, F401 — registra os modelos em Base.metadata

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Sobrescreve sqlalchemy.url do alembic.ini com o DATABASE_URL vindo do .env
# (pydantic-settings) — fonte única de configuração do projeto.
config.set_main_option("sqlalchemy.url", get_settings().database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata usada pelo --autogenerate (populada pelos modelos em T05).
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()