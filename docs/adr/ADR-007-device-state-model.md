# ADR-007 — Separação entre status de comunicação e estado operacional

## Status
Aceita (criada na revisão de QA da Fase 01)

## Contexto

O modelo inicial de `devices` listava um único campo `status`, usado ambiguamente tanto para "está se comunicando?" quanto, implicitamente, para possíveis estados administrativos futuros (equipamento recolhido, em manutenção, desativado). Um campo genérico `status` tende a virar uma "gaveta" onde significados diferentes se acumulam, dificultando queries e regras claras.

## Decisão

Separar conceitualmente (e como campos distintos) em `devices`:

- **`communication_status`** — `ONLINE` | `SEM_COMUNICACAO`. Reflete apenas se o dispositivo está se comunicando dentro do threshold configurado (ADR-003). Calculado a partir de `last_seen`; não é alterado por ações administrativas.
- **`operational_state`** — `ATIVO` | `RECOLHIDO` | `EM_MANUTENCAO` | `DESATIVADO` (lista pode crescer). Reflete decisões administrativas humanas sobre o ciclo de vida do equipamento, independente de estar ou não se comunicando no momento. Persistido diretamente (não calculado), alterado por ação explícita (fora do escopo de SPEC-001/SPEC-002).

Um equipamento `DESATIVADO` pode estar `SEM_COMUNICACAO` (óbvio) mas também um equipamento `ATIVO` pode estar `SEM_COMUNICACAO` (bateria descarregada, por exemplo) sem que isso implique qualquer mudança em `operational_state`. Os dois campos são ortogonais.

**Escopo para SPEC-001/SPEC-002:** apenas `communication_status` é relevante. `operational_state` é definido aqui para não ser reinventado ambiguamente depois, mas sua implementação (CRUD administrativo) fica para uma spec futura (provavelmente junto da Fase 06 — Eventos + Responsáveis, ou spec própria de gestão de equipamento).

## Consequências
- `PROJECT-CONTEXT.md` e `spec.md`/`plan.md` da SPEC-001 devem referenciar `communication_status`, nunca um campo `status` genérico.
- Dashboard (Fase 04) poderá futuramente filtrar/exibir os dois eixos de forma independente (ex.: "equipamentos ATIVOS que estão SEM_COMUNICACAO" é uma query diferente de "todos SEM_COMUNICACAO").
- Nenhuma regra de negócio deriva `operational_state` a partir de `communication_status` ou vice-versa — são preenchidos/alterados por fluxos diferentes.
