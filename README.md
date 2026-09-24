# Equipment Monitor

Plataforma de monitoramento de equipamentos (notebooks Dell / smartphones Samsung) utilizados em eventos corporativos, permitindo que um coordenador acompanhe status de comunicação, evento associado, responsável e histórico de cada equipamento.

Este não é um projeto acadêmico ou de portfólio — é o MVP de um produto comercial real.

## Documentação essencial (leia nesta ordem)

1. [`PROJECT-CONTEXT.md`](./PROJECT-CONTEXT.md) — contexto amplo do produto, regras de negócio, modelo conceitual, fases e estado atual.
2. [`CLAUDE.md`](./CLAUDE.md) — regras permanentes de engenharia para qualquer agente de IA trabalhando neste repositório.
3. [`AGENTS.md`](./AGENTS.md) — versão compatível com outras ferramentas de agente (aponta para CLAUDE.md).
4. [`docs/adr/`](./docs/adr/) — decisões arquiteturais registradas.
5. [`specs/`](./specs/) — especificações de cada vertical slice (spec.md, plan.md, tasks.md).

## Estado atual

Ver seção "CURRENT PROJECT STATE" em `PROJECT-CONTEXT.md`. Resumo: **Fase 01 (Levantamento e Arquitetura) em andamento** — documentação base criada, SPEC-001 (Device Heartbeat) especificada e pronta para implementação na Fase 02.

## Stack

- **Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, Pydantic, JWT, Pytest
- **Dashboard:** React, Vite, TypeScript
- **Windows Agent:** Python (futuramente empacotado como `.exe` / Windows Service)
- **Android:** Kotlin
- **Infra:** Docker, Docker Compose
- **Realtime:** WebSocket
- **Notificações:** Telegram

## Como rodar (a definir na Fase 02)

Instruções de setup local (Docker Compose, variáveis de ambiente, migrations) serão adicionadas ao final da Fase 02, junto com `docker-compose.yml` e `.env.example` funcionais.
