# TASK-010 — Tarefas da SPEC-010

## Etapa 1 — Cadastro de Equipamento com Credencial
- [ ] 1.1 Criar schemas `DeviceCreateRequest` e `DeviceCreateResponse` em `app/interface/api/v1/schemas/device_schema.py`.
- [ ] 1.2 Criar exceção `DeviceAlreadyExistsError` em `app/application/exceptions.py` e handler 409 em `app/interface/error_handlers.py`.
- [ ] 1.3 Estender contrato `DeviceRepository` em `app/application/ports/device_repository.py` com `add` e `get_by_asset_number`.
- [ ] 1.4 Implementar métodos no `SqlAlchemyDeviceRepository`.
- [ ] 1.5 Implementar `CreateDeviceUseCase` gerando par DeviceKey (Argon2) e persistência atômica.
- [ ] 1.6 Adicionar rota `POST /api/v1/devices` protegida por JWT de usuário em `app/interface/api/v1/devices.py`.
- [ ] 1.7 Escrever testes unitários do caso de uso e testes de API (201, 409, 401, 422).
- [ ] 1.8 Escrever teste de integração validando heartbeat autenticado com a credencial gerada no cadastro.
- [ ] 1.9 Implementar no Dashboard: botão "Cadastrar Equipamento", formulário e modal de exibição única da credencial gerada.
- [ ] 1.10 Rodar suíte completa de testes (`uv run pytest -q`) e validar ausência de regressões.

## Etapa 2 — Editar e Excluir Equipamento
- [ ] 2.1 Implementar `UpdateDeviceUseCase` e rota `PATCH /api/v1/devices/{device_id}`.
- [ ] 2.2 Implementar `DeleteDeviceUseCase` com revogação de credencial e rota `DELETE /api/v1/devices/{device_id}`.
- [ ] 2.3 Escrever testes unitários e de API para PATCH e DELETE.
- [ ] 2.4 Testar que credencial excluída retorna 401 no heartbeat.
- [ ] 2.5 Adicionar ações de editar e excluir no Dashboard com diálogo de confirmação.
- [ ] 2.6 Rodar suíte completa de testes.