FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Instala dependências antes de copiar o código: camada cacheada enquanto
# pyproject.toml/uv.lock não mudarem.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .
RUN uv sync --frozen

EXPOSE 8000

# Executa as migrações do banco (Alembic) e logo após inicia a aplicação
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.interface.main:app --host 0.0.0.0 --port ${PORT:-8000}"]