"""Entidade de domínio: User.

Representa uma pessoa que pode ser responsável por equipamentos dentro
do contexto de um evento.

Autenticação e autorização não fazem parte do escopo da Fase 06.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class User:
    id: UUID
    name: str
    email: str
    created_at: datetime | None = None
    updated_at: datetime | None = None