# SPEC-001 — Device Heartbeat

## O QUE

Permitir que um dispositivo já ativado (Windows Agent, futuramente Android) envie periodicamente um "heartbeat" ao backend, informando que está em funcionamento, e que o backend persista esse heartbeat e atualize a última comunicação conhecida (`last_seen`) do dispositivo.

Esta é a primeira vertical slice do produto: `device → API → autenticação → validação → use case → repository → PostgreSQL → resposta HTTP`.

## POR QUE

É a capacidade fundamental sobre a qual todo o resto do produto se apoia (status do equipamento, dashboard, alertas, histórico). Sem heartbeat funcional, nenhuma outra fase tem dado real para trabalhar.

## ESCOPO

**Dentro do escopo desta spec:**
- Endpoint `POST /api/v1/heartbeats`.
- Autenticação de dispositivo via credencial própria (ADR-006) — não via JWT de usuário.
- Validação do payload (Pydantic).
- Persistência do heartbeat em histórico (`heartbeats`), preservando registros anteriores.
- Atualização de `devices.last_seen` (e demais campos informados: `ip_address`, `battery_level`, `hostname` quando aplicável).
- Rejeição de heartbeat de dispositivo inexistente ou com credencial inválida.

**Fora do escopo (tratado em specs futuras):**
- Cálculo/atualização do campo `devices.status` (ONLINE/SEM COMUNICAÇÃO) — isso é SPEC-002 (Device Offline Detection), que consome o `last_seen` atualizado aqui.
- Fluxo de ativação do dispositivo (geração de código, emissão da credencial) — spec própria, pré-requisito de dados para esta.
- Dashboard, WebSocket, Telegram.

## REGRAS APLICÁVEIS

- REGRA 07: histórico de comunicação deve ser preservado (cada heartbeat gera uma linha em `heartbeats`, nunca sobrescreve).
- REGRA 08: `last_seen` representa a última comunicação conhecida.
- REGRA 09/10: esta spec **não** decide status — apenas registra a comunicação; a decisão de status é responsabilidade da SPEC-002.
- REGRA 16: toda entrada externa validada (schema Pydantic do heartbeat).
- REGRA 17: endpoint exige autenticação (credencial de dispositivo, ADR-006).

## CRITÉRIOS DE ACEITAÇÃO

- **AC-01:** Um dispositivo com credencial válida consegue enviar um heartbeat e recebe `201 Created`.
- **AC-02:** Após um heartbeat válido, `devices.last_seen` do dispositivo correspondente é atualizado para o horário de recebimento (não o horário informado pelo cliente, para evitar clock drift do agente).
- **AC-03:** O heartbeat é persistido como um novo registro em `heartbeats` (histórico), com `device_id`, `received_at`, `ip_address`, `battery_level`, `hostname`, `metadata`.
- **AC-04:** Um heartbeat com credencial inexistente ou inválida é rejeitado com `401 Unauthorized` e **não** é persistido.
- **AC-05:** Um payload malformado (campos obrigatórios ausentes/tipo inválido) é rejeitado com `422 Unprocessable Entity` e não altera `last_seen`.
- **AC-06:** Todo o comportamento acima possui testes automatizados (unitários para a regra de atualização de `last_seen`, testes de API para os códigos de status).

## PENDÊNCIAS / FORA DE DECISÃO NESTA SPEC

- Estratégia de cálculo de status (`ONLINE`/`SEM COMUNICAÇÃO`) — SPEC-002.
- Fluxo de ativação/emissão de credencial de dispositivo — spec própria (pré-requisito de dados de teste/seed para esta spec, não de código).
