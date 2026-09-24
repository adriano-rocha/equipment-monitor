# ADR-002 — Uso de PostgreSQL como banco de dados

## Status
Aceita

## Contexto
O sistema precisa preservar histórico de heartbeats e alertas (REGRA 07), com relacionamentos N:N (equipamento↔evento) e forte consistência transacional.

## Decisão
Usar PostgreSQL como banco relacional principal, acessado via SQLAlchemy (ORM) e Alembic (migrations versionadas).

## Consequências
- Suporte maduro a relacionamentos N:N, índices e integridade referencial.
- Alembic garante rastreabilidade de toda alteração estrutural.
- Volume de heartbeats pode crescer rapidamente; particionamento/retenção de `heartbeats` fica como possível otimização futura, não bloqueante para o MVP.
