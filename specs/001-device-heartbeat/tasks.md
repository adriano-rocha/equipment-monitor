# TASKS — SPEC-001 Device Heartbeat

- [ ] T01 — Estrutura inicial do backend (`backend/app/{domain,application,infrastructure,interface}`), `pyproject.toml` gerenciado via `uv` (sem Poetry), config via `pydantic-settings`.
- [ ] T02 — Docker Compose com serviço `postgres` + `backend`; `.env.example`.
- [ ] T03 — Alembic inicializado e configurado (`alembic init`, `env.py` apontando para a config do projeto).
- [ ] T04 — Entidades de domínio `Device` e `Heartbeat` (sem dependência de framework).
- [ ] T05 — Modelos SQLAlchemy `DeviceModel` e `HeartbeatModel` + migration inicial.
- [ ] T06 — Interfaces (ports) `DeviceRepository` e `HeartbeatRepository` em `application/ports`.
- [ ] T07 — Implementações concretas dos repositórios em `infrastructure`.
- [ ] T08 — `DeviceAuthService` (validação de `device_identifier`/token com hash — ADR-006).
- [ ] T09 — `RegisterHeartbeatUseCase` (application layer).
- [ ] T10 — Rota `POST /api/v1/heartbeats` + schemas Pydantic + dependência `get_current_device`.
- [ ] T11 — Mapeamento de erros de domínio → HTTP (401 credencial inválida/dispositivo não encontrado, 422 validação).
- [ ] T12 — Testes unitários do use case (repositórios fake).
- [ ] T13 — Testes de API cobrindo AC-01 a AC-05.
- [ ] T14 — Seed/fixture de device de teste para testes manuais (Postman/HTTPie).
- [ ] T15 — Atualizar `PROJECT-CONTEXT.md` (estado atual, próximo passo) e commitar (`feat: implement device heartbeat`).

## Definição de pronto (Definition of Done)
Todos os critérios de aceitação (AC-01 a AC-06) validados por teste automatizado, migrations aplicadas, documentação de estado atualizada, commit realizado.
