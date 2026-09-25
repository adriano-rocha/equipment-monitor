# PROJECT-CONTEXT.md — Equipment Monitor

> Este arquivo é a fonte de verdade sobre **o que é o produto**. Regras permanentes de engenharia ficam em `CLAUDE.md`. Requisitos específicos de cada funcionalidade ficam em `specs/`.

## 1. O que é este produto

Equipment Monitor é uma plataforma para uma empresa que fornece/aluga equipamentos (notebooks Dell com Windows, smartphones Samsung com Android) para eventos corporativos e grandes eventos (Expo São Paulo, Expo Transamérica, Anhembi, etc.). Um coordenador acompanha, via dashboard web, quais equipamentos estão online, sem comunicação ou offline, em qual evento estão, quem é o responsável, e o histórico de comunicação.

**Regra fundamental:** o sistema nunca afirma que um equipamento foi roubado apenas por falta de comunicação. O sistema distingue dois eixos independentes (ADR-007):

- `communication_status`: `ONLINE` | `SEM_COMUNICACAO`
- `operational_state`: `ATIVO` | `RECOLHIDO` | `EM_MANUTENCAO` | `DESATIVADO`

`SEM_COMUNICACAO` não significa automaticamente equipamento roubado. Perda de comunicação pode ter múltiplas causas (bateria, rede, desligamento, falha de agente, manutenção, etc.).

## 2. Arquitetura de alto nível

```
React + Vite (Dashboard)
        │
   REST API / WebSocket
        │
     FastAPI
        │
 Services / Use Cases
        │
    Repositories
        │
    PostgreSQL

Windows Agent ──► FastAPI
Android App   ──► FastAPI

FastAPI ──► Telegram
FastAPI ──► Google / Android Management (futuro)
```

Infra: Docker + Docker Compose, PostgreSQL, autenticação JWT, HTTPS em produção.

## 3. Regras de negócio (permanentes)

| # | Regra |
|---|-------|
| 01 | Todo equipamento possui um patrimônio operacional (`asset_number`). |
| 02 | O patrimônio **não** é chave primária do banco. |
| 03 | Cada dispositivo tem um identificador técnico interno (PK própria). |
| 04 | Um equipamento pode participar de vários eventos ao longo da vida útil. |
| 05 | Relacionamento equipamento↔evento é feito via tabela de associação (`event_devices`), nunca um `event_id` fixo dentro de `devices`. |
| 06 | Um equipamento pode ter diferentes responsáveis ao longo do tempo. |
| 07 | Histórico de comunicação (heartbeats) é preservado, nunca sobrescrito. |
| 08 | `last_seen` = última comunicação conhecida do dispositivo. |
| 09 | O **backend** decide se um dispositivo está online ou sem comunicação — nunca o agente. |
| 10 | O agente nunca se autodeclara offline. |
| 11 | Offline/sem comunicação **não** significa roubado. |
| 12 | Alertas e eventos importantes devem ser registrados. |
| 13–14 | Segredos nunca em código; sempre via variáveis de ambiente / mecanismo seguro. |
| 15 | Senhas com hash seguro (bcrypt/argon2). |
| 16 | Toda entrada externa é validada (Pydantic). |
| 17 | Endpoints protegidos exigem autenticação. |
| 18 | Ações administrativas exigem autorização por papel/permissão (RBAC). |

## 4. Modelo conceitual (Fase 02 — pode evoluir)

Entidades principais: `users`, `devices`, `events`, `event_devices`, `heartbeats`, `alerts`.
Entidades futuras possíveis: `employees`, `event_assignments`, `device_locations`, `device_commands`, `audit_logs`, `notification_channels`, `capabilities`.

Campos de referência, revisados na QA da Fase 01 (ver SPEC-001, ADR-006, ADR-007, ADR-008 para o desenho definitivo):

- **device**: id (UUID, PK), asset_number, type, manufacturer, model, serial_number, hostname, operating_system, battery_level, last_seen, `operational_state` (ATIVO/RECOLHIDO/EM_MANUTENCAO/DESATIVADO — ADR-007), created_at, updated_at. *(`communication_status` — ONLINE/SEM_COMUNICACAO — é calculado, não é coluna própria desta lista; ver ADR-007. Não existe mais campo genérico `status` nem `device_identifier` único.)*
- **device_credential**: id, device_id (FK), `key_id` (único, indexado), `secret_hash`, status (ACTIVE/REVOKED), created_at, revoked_at, last_used_at (ADR-006)
- **heartbeat**: id, device_id, received_at (servidor), `source_ip` (observado), `reported_ip` (informado pelo agente, opcional — ADR-008), battery_level, hostname, metadata, device_timestamp (informativo)
- **alert**: id, device_id, event_id, type, status, message, created_at, resolved_at
- **user**: id, name, email, password_hash, role, created_at, updated_at

Não adicionar campos/entidades por antecipação — apenas quando uma spec demonstrar necessidade.

## 5. Fases do projeto

| Fase | Objetivo | Status |
|------|----------|--------|
| 01 — Levantamento e Arquitetura | PROJECT-CONTEXT, CLAUDE.md, AGENTS.md, ADRs iniciais, primeira spec | **CONCLUÍDA**|
| 02 — Backend + PostgreSQL | FastAPI, SQLAlchemy, Alembic, Clean Architecture, SPEC-001 Device Heartbeat | Não iniciada |
| 03 — Windows Agent | Cliente Python de monitoramento (execução manual → Windows Service) | Não iniciada |
| 04 — Dashboard | React/Vite/TS, login, lista/detalhe de equipamentos | Não iniciada |
| 05 — Realtime + Telegram | WebSocket, detecção de mudança de status, alertas Telegram | Não iniciada |
| 06 — Eventos + Responsáveis | CRUD de eventos, associação equipamento↔evento↔responsável | Não iniciada |
| 07 — Android | App Kotlin usando a mesma plataforma/backend | Não iniciada |
| 08 — Android Recovery / Google Management | Validação de Find Hub, Lost Mode, Android Management API (matriz de validação obrigatória antes da Fase 10) | Não iniciada |
| 09 — Segurança Dell Nível 2 | BIOS/TPM/BitLocker/Secure Boot, matriz de compatibilidade | Não iniciada |
| 10 — Hardware Tracker Nível 3 | Só inicia após Fase 08 concluída; decisão via ADR (HARDWARE NECESSÁRIO / PARCIAL / NÃO NECESSÁRIO) | Bloqueada até Fase 08 |

## 6. Decisões e ambiguidades em aberto

Resolvidas durante a criação inicial ou na revisão de QA da Fase 01 (ver `docs/adr/`):

- ✅ Autenticação de dispositivo vs. usuário → **ADR-006** (credencial própria `key_id`/`secret`, separada de JWT de usuário).
- ✅ `id` interno vs. identificador de dispositivo → **ADR-006** (não existe mais `device_identifier` único; há `id` UUID como PK e `key_id` público como identificador de credencial — segredo nunca é PK nem patrimônio).
- ✅ Ambiguidade do campo `status` → **ADR-007** (`communication_status` calculado vs. `operational_state` persistido, conceitos ortogonais).
- ✅ IP informado vs. IP observado → **ADR-008** (`reported_ip` não confiável vs. `source_ip` autoritativo).
- ✅ Atomicidade do heartbeat → **ADR-003** (heartbeat + `last_seen` na mesma transação).
- ✅ Ruído de formatação do prompt original (seção 16 duplicada, fragmento cortado na Fase 08) — sem impacto em regra de negócio.
- ✅ Formato do header de autenticação de dispositivo → `Authorization: DeviceKey <key_id>:<secret>` (decidido no início da Fase 02).
- ✅ Tratamento de `X-Forwarded-For` → não é lido nesta fase; `source_ip` vem exclusivamente de `request.client.host` até haver infraestrutura de proxy confiável definida (decidido no início da Fase 02; ADR-008 será revisitada quando a infra de produção existir).

**Ainda em aberto (não bloqueiam a Fase 02):**

1. **Quem é o "responsável"?** A REGRA 06 fala em responsáveis que mudam ao longo do tempo, e a seção 9 do briefing original lista `employees` como entidade futura — não está definido se o responsável é um `user` do sistema (com login) ou um `employee` (cadastro simples, sem login). Fica como pendência para a spec de Eventos + Responsáveis (Fase 06).
2. **Configuração de intervalo/threshold de heartbeat.** Sugeridos 30s / 90s como valores iniciais configuráveis via variável de ambiente global no MVP (ADR-003). Granularidade por dispositivo/evento só será implementada se houver necessidade real comprovada.
3. **Formato exato do header de autenticação de dispositivo** (`Authorization: DeviceKey key_id:secret` vs. dois headers separados) — decisão de implementação, não arquitetural; fica para o início da Fase 02.
4. **Tratamento de `X-Forwarded-For` para `source_ip`** quando o deploy ficar atrás de proxy reverso — decisão de infraestrutura da Fase 02 (ADR-008 já cobre o desenho conceitual).

---

## CURRENT PROJECT STATE

**Fase atual:** FASE 01 — Levantamento e Arquitetura
**Status:** CONCLUÍDA (revisão de QA aplicada — ver histórico de commits)
**Última spec:** SPEC-001 — Device Heartbeat (especificada e revisada, ainda não implementada)
**Último commit:** ver `git log` (mensagens: fundação inicial + QA da Fase 01)

**Implementado:**
- Estrutura inicial do repositório
- `PROJECT-CONTEXT.md`, `CLAUDE.md`, `AGENTS.md`
- ADR-001 a ADR-008 (006/003 revisados na QA; 007 e 008 criados na QA)
- SPEC-001 (spec.md, plan.md, tasks.md) revisada: credencial `key_id`/`secret`, `communication_status` vs `operational_state`, `reported_ip` vs `source_ip`, atomicidade explícita, fluxo de autenticação sem lookup redundante
- Repositório versionado com Git, `.gitignore` cobrindo `.env` e artefatos comuns

**Testes:** nenhum ainda (Fase 02 não iniciada)

**Próximo passo:** FASE 02 — Backend + PostgreSQL, implementando SPEC-001 (Device Heartbeat) seguindo `plan.md` e `tasks.md` já revisados.

**Pendências:** ver seção 6 acima — nenhuma bloqueia o início da Fase 02.

**Decisões importantes:**
- Clean Architecture com separação Domain / Application (Use Cases) / Infrastructure / Interface (API).
- `asset_number` não é PK; PK interna própria (`id` UUID) por dispositivo.
- Autenticação de dispositivo via par `key_id` (público, indexado) + `secret` (hash forte), nunca um único token com hash (ADR-006).
- `communication_status` (calculado) e `operational_state` (persistido, administrativo) são campos separados e ortogonais (ADR-007).
- `communication_status` é sempre calculado pelo backend a partir de `last_seen`, nunca reportado pelo agente.
- Heartbeat + atualização de `last_seen` ocorrem em uma única transação (ADR-003).
- Gerenciamento de dependências Python via `uv` (`pyproject.toml` + `uv.lock`), sem Poetry.
