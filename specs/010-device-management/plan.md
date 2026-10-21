# PLAN-010 — Implementação da Gestão de Equipamentos

## 1. Arquitetura e Camadas (Clean Architecture)

### Domain
* Entidade `Device`: validar integridade dos campos de inventário e tipos permitidos (`notebook`, `tablet`, `smartphone`).
* Adicionar exceção de aplicação `DeviceAlreadyExistsError`.

### Application Ports
* Estender `DeviceRepository`:
  * `add(device: Device) -> Device`
  * `get_by_asset_number(asset_number: str) -> Device | None`
  * `get_by_id(device_id: UUID) -> Device | None`
  * `update(device: Device) -> Device`
* Repositório/serviço de credenciais: persistir a credencial gerada vinculada ao `device_id`.

### Use Cases
* `CreateDeviceUseCase`:
  1. Valida unicidade de `asset_number` (se já existir, lança `DeviceAlreadyExistsError`).
  2. Cria a entidade `Device`.
  3. Gera `key_id` aleatório seguro (`key_` + 16 hex bytes) e `secret` aleatório seguro (`sec_` + 32 urlsafe bytes) via biblioteca `secrets`.
  4. Gera o hash Argon2 do segredo via serviço de criptografia/Argon2 existente.
  5. Adiciona o dispositivo e a credencial ativa ao banco de forma atômica (mesma transação).
  6. Retorna DTO contendo os dados do dispositivo e as credenciais (`key_id` e `secret` em claro).
* `UpdateDeviceUseCase` (Etapa 2): atualização de campos cadastrais com validação de unicidade.
* `DeleteDeviceUseCase` (Etapa 2): soft-delete/desativação e revogação imediata da credencial.

### Infrastructure
* Implementação nos repositórios SQLAlchemy usando `session.flush()`.
* O commit é delegado para o final da requisição em `get_db_session`.
* Tratamento de corrida: capturar `IntegrityError` no flush do `asset_number` e converter em `DeviceAlreadyExistsError`.

### Interface (FastAPI)
* Schemas Pydantic em `app/interface/api/v1/schemas/device_schema.py`:
  * `DeviceCreateRequest`:
    * `asset_number: str` (obrigatório, 1-50 caracteres, espaços aparados).
    * `device_type: Literal["notebook", "tablet", "smartphone"] | None = None`.
    * `manufacturer: str | None = None` (máx 100).
    * `model: str | None = None` (máx 150).
    * `serial_number: str | None = None` (máx 150).
    * `model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)`.
  * `DeviceCredentialsResponse`: `key_id: str`, `secret: str`.
  * `DeviceCreateResponse`: herda ou inclui os dados do dispositivo mais o objeto `credentials`.
* Error Handler registrado no FastAPI para `DeviceAlreadyExistsError` retornando HTTP 409 Conflict.
* Rota `POST /api/v1/devices` protegida pela dependência `get_current_user` (JWT).

### Dashboard (React)
* Componente de modal para cadastro com formulário validado.
* Modal de visualização de credencial exibido imediatamente após o sucesso do cadastro:
  * Exibe `key_id` e `secret`.
  * Botões de "Copiar".
  * Aviso: *"Guarde esta credencial com segurança. O segredo não será exibido novamente."*
* Atualização automática da tabela de listagem ao fechar o modal.

## 2. Estratégia de Testes
1. Unitários: `CreateDeviceUseCase` com fake repository (sucesso, patrimônio duplicado gerando erro, atomicidade).
2. Integração: `SqlAlchemyDeviceRepository` com PostgreSQL real testando `add` e `get_by_asset_number`.
3. API: `POST /api/v1/devices` (201 Created, 401 Unauthorized sem token, 409 Conflict em duplicidade, 422 em campos proibidos ou inválidos).
4. End-to-End da Credencial: Criar equipamento via API -> capturar `key_id` e `secret` retornados -> enviar `POST /api/v1/heartbeats` com o header `Authorization: DeviceKey <key_id>:<secret>` -> validar HTTP 201 e persistência do heartbeat.