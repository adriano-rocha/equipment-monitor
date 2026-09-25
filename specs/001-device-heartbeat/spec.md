# SPEC-001 — Device Heartbeat

## O QUE

Permitir que um dispositivo já ativado (Windows Agent, futuramente Android) envie periodicamente um "heartbeat" ao backend, informando que está em funcionamento, e que o backend persista esse heartbeat e atualize a última comunicação conhecida (`last_seen`) do dispositivo.

Esta é a primeira vertical slice do produto: `device → API → autenticação → validação → use case → repository → PostgreSQL → resposta HTTP`.

## POR QUE

É a capacidade fundamental sobre a qual todo o resto do produto se apoia (status do equipamento, dashboard, alertas, histórico). Sem heartbeat funcional, nenhuma outra fase tem dado real para trabalhar.

## ESCOPO

**Dentro do escopo desta spec:**
- Endpoint `POST /api/v1/heartbeats`.
- Autenticação de dispositivo via header `Authorization: DeviceKey <key_id>:<secret>` (ADR-006) — não via JWT de usuário. Header ausente, malformado, ou credencial inválida/revogada → `401`, sem revelar se o `key_id` não existe ou se o `secret` está incorreto (mensagem de erro genérica, para não dar pista a um atacante sobre qual parte da credencial atacar).
- Validação do payload (Pydantic), conforme contrato detalhado abaixo.
- Persistência do heartbeat em histórico (`heartbeats`), preservando registros anteriores.
- Atualização transacional de `devices.last_seen` (e demais campos informados: `reported_ip`, `battery_level`, `hostname` quando aplicável) — heartbeat e atualização de `last_seen` confirmam juntos ou nenhum dos dois é persistido (ADR-003).
- Captura de `source_ip` observado pela infraestrutura (ADR-008).
- Rejeição de heartbeat de dispositivo inexistente, com credencial inválida ou revogada.

**Fora do escopo (tratado em specs futuras):**
- Cálculo/atualização de `communication_status` (ONLINE/SEM_COMUNICACAO) — isso é SPEC-002 (Device Offline Detection), que consome o `last_seen` atualizado aqui. Ver ADR-007 para a separação entre `communication_status` e `operational_state`.
- Fluxo de ativação do dispositivo (geração de `key_id`/`secret`) — spec própria, pré-requisito de dados para esta.
- Revogação/rotação de credencial — spec futura de gestão de credenciais (ADR-006).
- Dashboard, WebSocket, Telegram.

## CONTRATO DO HEARTBEAT

**Autenticação (não vai no corpo da requisição):** header `Authorization: DeviceKey <key_id>:<secret>` do dispositivo. Requisição sem credencial válida e ativa (`status = ACTIVE`) é rejeitada antes de qualquer validação de payload, com erro genérico (não distingue "key_id inexistente" de "secret incorreto").

**Corpo da requisição — todos os campos são opcionais** (um heartbeat "vazio", apenas autenticado, já é válido — a requisição em si é o sinal de vida):

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `hostname` | string | não | máx. 255 caracteres |
| `reported_ip` | string | não | formato IPv4 ou IPv6 válido; tratado como não confiável (ADR-008) |
| `battery_level` | int | não | 0–100 |
| `metadata` | objeto JSON | não | tamanho máx. 2 KB serializado; sem aninhamento obrigatório específico no MVP |
| `device_timestamp` | datetime (ISO 8601) | não | apenas informativo/observabilidade (ex.: detectar drift de relógio do agente); **nunca** substitui `received_at` |

**Campos gerados pelo servidor (não vêm do cliente):**
- `received_at` — horário de recebimento no servidor; é o horário oficial do heartbeat e o único usado para calcular `last_seen`/status de comunicação.
- `source_ip` — IP de origem observado pela infraestrutura HTTP (ADR-008).

Um campo com tipo/formato inválido (ex.: `battery_level: 150`, `reported_ip: "abc"`) causa rejeição do heartbeat inteiro com `422`, nunca é persistido parcialmente.

## REGRAS APLICÁVEIS

- REGRA 07: histórico de comunicação deve ser preservado (cada heartbeat gera uma linha em `heartbeats`, nunca sobrescreve).
- REGRA 08: `last_seen` representa a última comunicação conhecida, sempre baseada em `received_at` do servidor.
- REGRA 09/10: esta spec **não** decide `communication_status` — apenas registra a comunicação; a decisão de status é responsabilidade da SPEC-002.
- REGRA 16: toda entrada externa validada (schema Pydantic do heartbeat, tabela de validação acima).
- REGRA 17: endpoint exige autenticação (credencial de dispositivo `key_id`/`secret`, ADR-006).

## CRITÉRIOS DE ACEITAÇÃO

- **AC-01:** Um dispositivo com credencial válida e ativa (`key_id` + `secret` corretos, `status = ACTIVE`) consegue enviar um heartbeat (corpo vazio ou com campos opcionais) e recebe `201 Created`.
- **AC-02:** Após um heartbeat válido, `devices.last_seen` do dispositivo correspondente é atualizado para `received_at` (horário do servidor), nunca para `device_timestamp` enviado pelo cliente.
- **AC-03:** O heartbeat é persistido como um novo registro em `heartbeats` (histórico), com `device_id`, `received_at`, `source_ip`, `reported_ip` (se enviado), `battery_level` (se enviado), `hostname` (se enviado), `metadata` (se enviado), `device_timestamp` (se enviado).
- **AC-04:** Um heartbeat com `key_id` inexistente, `secret` incorreto ou credencial `REVOKED` é rejeitado com `401 Unauthorized` (mensagem genérica, sem indicar qual parte da credencial falhou) e **não** é persistido (nem heartbeat, nem alteração em `devices`).
- **AC-05:** Um payload com campo de tipo/formato inválido (ex.: `battery_level` fora de 0–100, `reported_ip` malformado) é rejeitado com `422 Unprocessable Entity` e não altera `last_seen` nem persiste heartbeat.
- **AC-06:** A gravação do heartbeat e a atualização de `devices.last_seen` ocorrem na mesma transação: uma falha na atualização de `devices` impede a gravação do heartbeat (rollback), e vice-versa — nunca ficam inconsistentes entre si.
- **AC-07:** Todo o comportamento acima possui testes automatizados (unitários para a regra de atualização de `last_seen` e para a atomicidade, testes de API para os códigos de status e validação de campos).

## PENDÊNCIAS / FORA DE DECISÃO NESTA SPEC

- Estratégia de cálculo de `communication_status` (`ONLINE`/`SEM_COMUNICACAO`) — SPEC-002.
- Fluxo de ativação/emissão de credencial de dispositivo — spec própria (pré-requisito de dados de teste/seed para esta spec, não de código).