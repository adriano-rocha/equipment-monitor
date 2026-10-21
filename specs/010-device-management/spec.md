# SPEC-010 — Device Management (CRUD e Emissão de Credenciais)

## 1. Identificação
* **Código:** SPEC-010
* **Nome:** Device Management
* **Fase:** 04 / 06 (Extensão do MVP)
* **Status:** Aprovada
* **Dependências:** SPEC-001 (Heartbeat), Autenticação JWT do Coordenador

## 2. Objetivo
Permitir que o Coordenador cadastre, consulte, edite e desative equipamentos através do Dashboard. No momento do cadastro de um novo equipamento, o sistema gera de forma atômica o par de credenciais (`key_id` e `secret`) que permitirá ao agente (Windows ou Android) autenticar os heartbeats.

## 3. Regras de Negócio e Decisões

### RN-001 — Campos de Cadastro (POST /api/v1/devices)
* **Obrigatório:** `asset_number` (string de 1 a 50 caracteres, único, sem espaços nas pontas).
* **Opcionais:**
  * `device_type`: lista fechada (`notebook`, `tablet`, `smartphone`).
  * `manufacturer`: string de até 100 caracteres.
  * `model`: string de até 150 caracteres.
  * `serial_number`: string de até 150 caracteres.
* **Proibidos (rejeição 422 extra="forbid"):** `hostname`, `reported_ip`, `battery_level`, `last_seen`, `status`, `id`.

### RN-002 — Emissão Atômica de Credencial (ADR-006)
* Ao criar o dispositivo, o backend gera um `key_id` aleatório seguro (ex: `key_` + 16 bytes hex) e um `secret` (32 bytes urlsafe).
* O `secret` é convertido em hash Argon2 e persistido na tabela `device_credentials` com status `ACTIVE`.
* O `secret` em claro é retornado **uma única vez** no corpo de resposta do `POST`.
* O `secret` nunca é persistido em claro, nunca é logado e nunca é retornado em endpoints subsequentes (`GET`, `PATCH`).
* Dispositivo e credencial são criados na mesma transação. Se a credencial falhar, o dispositivo sofre rollback.

### RN-003 — Edição de Inventário (PATCH /api/v1/devices/{device_id})
* Permite atualizar: `asset_number`, `device_type`, `manufacturer`, `model`, `serial_number`.
* Se o `asset_number` for alterado para um patrimônio já existente em outro dispositivo, o backend retorna `409 Conflict`.

### RN-004 — Exclusão e Histórico (DELETE /api/v1/devices/{device_id})
* Conforme Decisão A: Soft Delete / Desativação.
* Ao excluir, a credencial do dispositivo é imediatamente revogada (`status = REVOKED`, `revoked_at = now()`).
* O histórico de heartbeats anteriores é integralmente preservado (Regra 07).
* Vínculos ativos em `event_devices` são encerrados com `unassigned_at = now()`.
* Qualquer heartbeat futuro enviado com a credencial excluída receberá `401 Unauthorized`.
* O dispositivo deixa de ser listado na visualização padrão de equipamentos ativos do painel.

## 4. Contratos de API

### POST /api/v1/devices
* **Headers:** `Authorization: Bearer <jwt_coordenador>`
* **Request Body:**
```json
{
  "asset_number": "PAT-2026-001",
  "device_type": "smartphone",
  "manufacturer": "Samsung",
  "model": "Galaxy A54",
  "serial_number": "SM-A546B-123456"
}

Response 201 Created:

{
  "id": "c803c0a9-5ed0-4b4d-bded-5353dec3569d",
  "asset_number": "PAT-2026-001",
  "device_type": "smartphone",
  "manufacturer": "Samsung",
  "model": "Galaxy A54",
  "serial_number": "SM-A546B-123456",
  "hostname": null,
  "reported_ip": null,
  "battery_level": null,
  "last_seen": null,
  "status": "SEM REGISTRO",
  "credentials": {
    "key_id": "key_7f8a9b1c2d3e4f5a",
    "secret": "sec_w8X3y9Z...token_exibido_uma_unica_vez"
  }
}

Erros:  
    401 Unauthorized: Token JWT ausente ou inválido.
    409 Conflict: {"detail": "Asset number PAT-2026-001 already registered"}.
    422 Unprocessable Entity: Campos proibidos ou formato inválido.
    PATCH /api/v1/devices/{device_id}
    Headers: Authorization: Bearer <jwt_coordenador>
    Request Body: Campos parciais permitidos (asset_number, device_type, manufacturer, model, serial_number).
    Response 200 OK: DeviceResponse atualizado.
    Erros: 404 Not Found, 409 Conflict, 422 Unprocessable Entity.
DELETE /api/v1/devices/{device_id}
    Headers: Authorization: Bearer <jwt_coordenador>
    Response 204 No Content
    Erros: 404 Not Found.
5. Critérios de Aceitação
    POST /api/v1/devices persiste o equipamento e a credencial com hash Argon2 na mesma transação.
    POST /api/v1/devices com patrimônio duplicado responde 409 Conflict e não altera o banco.
    A credencial gerada autentica com sucesso um POST /api/v1/heartbeats (HTTP 201).
    No Dashboard, o modal exibe key_id e secret uma única vez, com botão de cópia e aviso de que não poderá ser recuperado.
    PATCH permite corrigir o patrimônio e retorna 409 se colidir com outro existente.
    DELETE revoga a credencial e impede novos heartbeats (HTTP 401).

---

### 2. `specs/010-device-management/plan.md`

```markdown
# PLAN-010 — Implementação da Gestão de Equipamentos

## 1. Arquitetura e Camadas (Clean Architecture)

### Domain
* Entidade `Device`: validar integridade dos campos de inventário e tipos permitidos (`notebook`, `tablet`, `smartphone`).
* Adicionar exceção de domínio/aplicação `DeviceAlreadyExistsError` e `InvalidDeviceTypeError`.

### Application Ports
* Estender `DeviceRepository`:
  * `add(device: Device) -> Device`
  * `get_by_asset_number(asset_number: str) -> Device | None`
  * `get_by_id(device_id: UUID) -> Device | None`
  * `update(device: Device) -> Device`
* Estender `DeviceCredentialRepository` (se aplicável) ou utilizar serviço de credenciais para persistir a credencial gerada.

### Use Cases
* `CreateDeviceUseCase`:
  1. Verifica unicidade de `asset_number`.
  2. Gera `key_id` (`key_` + `secrets.token_hex(8)`) e `secret` (`sec_` + `secrets.token_urlsafe(32)`).
  3. Gera hash Argon2 do segredo via `DeviceAuthService` ou utilitário correspondente.
  4. Adiciona dispositivo e credencial ativa ao banco.
  5. Retorna o DTO com dados do dispositivo e credencial em claro.
* `UpdateDeviceUseCase`: atualiza dados cadastrais, validando duplicidade se o patrimônio mudar.
* `DeleteDeviceUseCase`: revoga credencial, finaliza vínculos em eventos e marca soft-delete / remove da listagem ativa.

### Infrastructure
* Implementação nos repositórios SQLAlchemy usando `session.flush()`.
* O commit é delegado para o final da requisição em `get_db_session`.
* Tratamento de corrida: capturar `IntegrityError` no flush do `asset_number` e converter em `DeviceAlreadyExistsError`.

### Interface (FastAPI)
* Schemas Pydantic:
  * `DeviceCreateRequest` (com `model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)`).
  * `DeviceUpdateRequest`.
  * `DeviceCreateResponse` (inclui objeto `credentials`).
  * `DeviceResponse` (já existente, usado nas consultas e edições).
* Error Handler registrado no FastAPI para `DeviceAlreadyExistsError` -> HTTP 409.

### Dashboard (React)
* Componente `CreateDeviceModal`: formulário com validação.
* Componente `CredentialsDisplayModal`: visualização de `key_id` e `secret` com botão de cópia rápida e confirmação "Copiei e guardei a credencial".
* Atualização da listagem de dispositivos após cadastro.

## 2. Estratégia de Testes
1. Unitários: `CreateDeviceUseCase` com fake repository (sucesso, duplicidade, rollback em falha).
2. Integração: Repositório SQLAlchemy e unicidade de `asset_number` com PostgreSQL real.
3. API: `POST /api/v1/devices` (201, 401, 409, 422).
4. End-to-End da Credencial: Criar dispositivo via use case/API -> usar as credenciais retornadas para disparar `POST /api/v1/heartbeats` -> verificar status 201 e persistência.    