FROM python:3.12-slim-bookworm

WORKDIR /app

# 1. Atualiza pacotes da base Debian para corrigir CVEs e instala ferramentas de compilação
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Instala o binário seguro do uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# 3. Instala as dependências do projeto
COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml

# 4. Remove o compilador para fechar a superfície de ataque e limpar a imagem
RUN apt-get purge -y gcc && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# 5. Copia o código da aplicação
COPY . .

EXPOSE 8000

# Executa migrações automáticas do banco e sobe a API em 0.0.0.0
CMD sh -c "alembic upgrade head && uvicorn app.interface.main:app --host 0.0.0.0 --port 8000"