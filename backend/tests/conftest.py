"""Fixture de escopo global — cria/derruba o schema do banco de teste UMA vez
por execução completa da suíte (compartilhado por tests/integration/ e
tests/api/)."""

import pytest

from tests.database import create_test_schema, drop_test_schema


@pytest.fixture(scope="session", autouse=True)
def _test_database_schema():
    create_test_schema()
    yield
    drop_test_schema()