"""Configuração compartilhada do banco de teste (equipment_monitor_test) —
usada pelos testes de integração (T07/T13) e de API (T14). PostgreSQL real,
sem Testcontainers (decisão da Fase 02)."""

import os

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infrastructure.config import REPO_ROOT
from app.infrastructure.db import models  # noqa: F401 — registra os modelos em Base.metadata
from app.infrastructure.db.base import Base

load_dotenv(REPO_ROOT / ".env")

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit(
        "TEST_DATABASE_URL não definido no .env — necessário para os testes de integração/API "
        "(ex.: postgresql+psycopg://equipment_monitor:changeme@localhost:5434/equipment_monitor_test)."
    )

test_engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=test_engine, expire_on_commit=False)


def create_test_schema() -> None:
    Base.metadata.create_all(test_engine)


def drop_test_schema() -> None:
    Base.metadata.drop_all(test_engine)