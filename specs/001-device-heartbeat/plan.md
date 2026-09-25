# PLAN — SPEC-001 Device Heartbeat

## Camadas (Clean Architecture)

```
Interface (FastAPI)
  POST /api/v1/heartbeats
  ├── HeartbeatRequestSchema (Pydantic): hostname?, reported_ip?, battery_level?, metadata?, device_timestamp?
  └── dependência get_current_device:
        1. extrai key_id + secret do header `Authorization: DeviceKey <key_id>:<secret>` (esquema obrigatório; ausente/malformado → 401)
        2. busca DeviceCredential por key_id (indexado)
        3. valida status == ACTIVE e secret contra secret_hash
        4. carrega e retorna a entidade Device já resolvida
      (a rota recebe o Device já carregado — nenhuma camada abaixo busca o device de novo)
        │
Application (Use Case)
  RegisterHeartbeatUseCase(device: Device, payload: HeartbeatInput, source_ip: str)
    Recebe o Device já resolvido pela autenticação (não um device_id) — elimina o lookup
    redundante identificado na revisão de QA.
    Executa em UMA transação (ADR-003):
      1. received_at = now() (servidor)
      2. cria entidade Heartbeat (device_id=device.id, received_at, source_ip, reported_ip,
         battery_level, hostname, metadata, device_timestamp)
      3. persiste via HeartbeatRepository.create (dentro da transação)
      4. atualiza device.last_seen = received_at (+ hostname/reported_ip/battery_level se
         enviados) via DeviceRepository.update (dentro da mesma transação)
      5. commit único; qualquer exceção em (3) ou (4) provoca rollback de ambos
      6. retorna HeartbeatResult
        │
Domain
  Device (entidade) — não conhece FastAPI/SQLAlchemy
  Heartbeat (entidade)
  DeviceCredential (entidade — key_id, secret_hash, status)
        │
Infrastructure
  SQLAlchemy models: DeviceModel, HeartbeatModel, DeviceCredentialModel
  DeviceRepository / HeartbeatRepository / DeviceCredentialRepository
  DeviceAuthService — resolve credencial por key_id, valida secret (ADR-006)
```

## Passo a passo de implementação

1. **Config base do backend:** estrutura `backend/app/{domain,application,infrastructure,interface}`, config via variáveis de ambiente (pydantic-settings), conexão SQLAlchemy, Alembic inicializado.
2. **Domain:** entidades `Device`, `Heartbeat`, `DeviceCredential` (dataclasses/Pydantic puros, sem SQLAlchemy).
3. **Infrastructure — modelos e migration:**
   - `DeviceModel`: id (UUID, PK), asset_number, type, manufacturer, model, serial_number, hostname, operating_system, battery_level, last_seen, operational_state (default `ATIVO` — ADR-007), created_at, updated_at. _(`communication_status` NÃO é campo persistido nesta spec — é calculado na SPEC-002.)_
   - `HeartbeatModel`: id, device_id (FK), received_at, source_ip, reported_ip (nullable), battery_level (nullable), hostname (nullable), metadata (nullable JSON), device_timestamp (nullable).
   - `DeviceCredentialModel`: id, device_id (FK), key_id (unique, indexed), secret_hash, status (`ACTIVE`/`REVOKED`), created_at, revoked_at (nullable), last_used_at (nullable).
   - Gerar migration Alembic única cobrindo as três tabelas.
4. **Infrastructure — repositórios:** interfaces (ports) em `application/ports` + implementações concretas em `infrastructure`, incluindo `DeviceCredentialRepository.get_by_key_id`.
5. **Infrastructure — auth de dispositivo:** `DeviceAuthService.authenticate(key_id, secret) -> Device`. Lookup por `key_id` (indexado) → valida `status == ACTIVE` → verifica `secret` com hash forte (ex. argon2) → retorna o `Device` associado (carregado uma única vez). **Nota transacional:** a atualização de `last_used_at` da credencial não é parte da regra de consistência do heartbeat (ADR-003) — para evitar duas transações de escrita separadas por requisição sem necessidade (uma na autenticação, outra no use case), `last_used_at` é atualizado dentro da MESMA transação do use case (passo 5 do fluxo do `RegisterHeartbeatUseCase` acima — junto com o INSERT do heartbeat e o UPDATE de `last_seen`), não em um commit isolado durante a autenticação. Isso é uma decisão de implementação explícita, não deixada implícita no código.
6. **Application:** `RegisterHeartbeatUseCase(device, credential_id, payload, source_ip)` — recebe o `Device` já resolvido; testável isoladamente com repositórios fake/in-memory; a transação (passos 3, 4 e 5 do fluxo acima: insert heartbeat + update last_seen + update last_used_at) é responsabilidade explícita do use case (ou de um `UnitOfWork` simples injetado, a decidir na implementação sem overengineering).
7. **Interface:**
   - dependência `get_current_device` (implementa o fluxo de autenticação acima, retorna `Device` + `credential_id`);
   - captura de `source_ip` a partir do `Request` do FastAPI, exclusivamente via `request.client.host` (`X-Forwarded-For` não é lido nesta fase — ver `PROJECT-CONTEXT.md`);
   - rota `POST /api/v1/heartbeats` orquestra: recebe `Device` + `credential_id` (via dependência) + payload validado + `source_ip` → chama o use case → mapeia resultado para `201`.
   - mapeamento de exceções de domínio → HTTP: credencial ausente/inválida/revogada → 401; erro de validação Pydantic → 422 (automático).
8. **Testes:**
   - Unitários: `RegisterHeartbeatUseCase` com repositórios fake (sucesso, falha simulada em cada etapa para validar rollback conceitual).
   - Unitários: `DeviceAuthService` (key_id inexistente, secret incorreto, credencial revogada, credencial válida).
   - Integração: repositórios reais contra Postgres de teste, validando que heartbeat + `last_seen` são persistidos atomicamente.
   - API: `TestClient` do FastAPI cobrindo AC-01 a AC-07.
9. **Seed mínimo para testes manuais:** script/fixture que cria um device + uma `DeviceCredential ACTIVE` com `key_id`/`secret` conhecidos (não é o fluxo de ativação real, apenas dado de apoio).

## Fora do plano desta spec

- Cálculo de `communication_status` (`ONLINE`/`SEM_COMUNICACAO`) — SPEC-002, apenas consome `last_seen`.
- CRUD de `operational_state` — spec futura (ADR-007).
- Revogação/rotação de credencial via API — spec futura (ADR-006); a estrutura de dados já suporta, mas não expomos endpoint nesta spec.
- Qualquer endpoint de consulta/listagem de heartbeats — não pedido pelos critérios de aceitação; não implementar por antecipação.
