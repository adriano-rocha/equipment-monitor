# TASKS-006 — Events + Responsibles

## 1. Identificação

* **Código:** TASKS-006
* **Nome:** Events + Responsibles
* **Fase:** 06
* **SPEC:** `specs/006-events-responsibles/spec.md`
* **PLAN:** `specs/006-events-responsibles/plan.md`
* **Status:** Pronto para implementação
* **Dependências:** Fases 01–05 concluídas

---

# 2. Instruções gerais para o agente

Antes de executar qualquer tarefa:

1. Ler integralmente:

   * `AGENTS.md`
   * `CLAUDE.md`
   * `PROJECT-CONTEXT.md`
   * `specs/006-events-responsibles/spec.md`
   * `specs/006-events-responsibles/plan.md`

2. Inspecionar a estrutura real do projeto.

3. Não assumir que os caminhos sugeridos no `plan.md` existem.

4. Reutilizar padrões já existentes.

5. Não duplicar models, repositories, services ou schemas.

6. Não alterar funcionalidades das Fases 01–05 sem necessidade.

7. Não implementar funcionalidades da Fase 07.

8. Após cada bloco relevante:

   * executar testes;
   * verificar erros;
   * corrigir antes de avançar.

9. Não criar infraestrutura externa.

10. Não utilizar:

* Redis;
* Celery;
* RabbitMQ;
* Kafka.

11. Não criar `devices.event_id`.

12. Não transformar `asset_number` em chave primária.

13. O status do equipamento continuará sendo responsabilidade do backend.

14. Não implementar lógica de status no frontend.

15. Manter o código compatível com a arquitetura atual.

---

# 3. Ordem das tarefas

```text
TASK-001
   ↓
TASK-002
   ↓
TASK-003
   ↓
TASK-004
   ↓
TASK-005
   ↓
TASK-006
   ↓
TASK-007
   ↓
TASK-008
   ↓
TASK-009
   ↓
TASK-010
   ↓
TASK-011
   ↓
TASK-012
   ↓
TASK-013
   ↓
TASK-014
   ↓
TASK-015
   ↓
TASK-016
   ↓
TASK-017
   ↓
TASK-018
   ↓
TASK-019
```

---

# 4. TASK-001 — Inspeção da arquitetura atual

## Objetivo

Conhecer a estrutura atual antes de modificar o código.

## Ações

Inspecionar:

```text
backend/app/
backend/alembic/
dashboard/src/
```

Identificar:

* models existentes;
* repositories;
* services;
* schemas;
* routers;
* configuração de banco;
* migrations;
* estrutura de usuários, caso exista;
* estrutura atual de `Device`.

## Validação

Confirmar:

* onde o model `Device` está;
* onde os repositories estão;
* onde as migrations estão;
* se `User` já existe;
* como os routers são organizados;
* como os testes existentes são estruturados.

## Regra

Não modificar código nesta tarefa.

---

# 5. TASK-002 — Revisar modelo Device

## Objetivo

Garantir que o cadastro operacional previsto na Fase 06 seja compatível com o modelo existente.

## Ações

Verificar se `Device` possui:

```text
asset_number
device_type
manufacturer
model
serial_number
hostname
```

Caso algum campo realmente necessário esteja ausente:

* propor alteração;
* adicionar migration;
* atualizar model;
* atualizar schemas;
* atualizar repository;
* preservar compatibilidade com heartbeat.

## Validação

Garantir que:

```text
id
```

continue sendo a identidade interna do equipamento.

`asset_number` não poderá se tornar primary key.

---

# 6. TASK-003 — Revisar/criar User

## Objetivo

Garantir que exista uma entidade `User` utilizável como responsável.

## Ações

Se `User` já existir:

* reutilizar;
* não duplicar.

Se não existir:

criar estrutura mínima contendo:

```text
id
name
email
created_at
updated_at
```

Não implementar autenticação completa nesta tarefa.

## Validação

Deve ser possível referenciar um usuário por UUID.

---

# 7. TASK-004 — Criar Event model

## Objetivo

Criar a entidade de eventos.

## Campos

Implementar:

```text
id
name
location
starts_at
ends_at
is_active
created_at
updated_at
```

## Regras

* UUID;
* `name` obrigatório;
* `location` obrigatório;
* `starts_at` obrigatório;
* `ends_at` obrigatório;
* `ends_at > starts_at`;
* timestamps timezone-aware.

## Validação

Model deve funcionar com SQLAlchemy e seguir o padrão existente.

---

# 8. TASK-005 — Criar EventDevice model

## Objetivo

Criar a relação entre eventos e equipamentos.

## Estrutura mínima

```text
id
event_id
device_id
assigned_user_id
assigned_at
unassigned_at
created_at
updated_at
```

## Foreign keys

```text
event_id → events.id
device_id → devices.id
assigned_user_id → users.id
```

## Regras

* não criar `devices.event_id`;
* permitir um equipamento em vários eventos;
* permitir histórico;
* permitir responsável contextual;
* impedir associação ativa duplicada.

## Validação

Criar testes unitários/integrados para as constraints relevantes.

---

# 9. TASK-006 — Criar migration Alembic

## Objetivo

Persistir a nova modelagem.

## Ações

Criar migration para:

* `events`;
* `event_devices`;
* `users`, somente se necessário;
* novos campos de `devices`, somente se necessários;
* foreign keys;
* índices;
* constraints.

## Regras

Não modificar migrations antigas.

## Validação

Executar:

```text
alembic upgrade head
```

e confirmar sucesso.

Depois testar:

```text
alembic downgrade -1
alembic upgrade head
```

---

# 10. TASK-007 — Implementar Event Repository

## Objetivo

Criar persistência para eventos.

## Operações

Implementar:

```text
create
get_by_id
list
update
```

## Regras

Repository não deve conter regras de negócio complexas.

---

# 11. TASK-008 — Implementar EventDevice Repository

## Objetivo

Persistir associações equipamento/evento.

## Operações

Implementar:

```text
create
get_by_id
list_by_event
list_by_device
update
close_assignment
```

## Deve suportar

* associação;
* consulta;
* responsável;
* encerramento;
* histórico.

---

# 12. TASK-009 — Implementar Event Service

## Objetivo

Centralizar regras de negócio de eventos.

## Operações

Implementar:

```text
create_event
get_event
list_events
update_event
```

## Validações

* evento existente;
* datas válidas;
* campos obrigatórios.

---

# 13. TASK-010 — Implementar EventDevice Service

## Objetivo

Centralizar regras de associação.

## Operações

Implementar:

```text
assign_device_to_event
get_event_devices
close_device_assignment
assign_responsible
change_responsible
```

## Validar

Antes de associar:

```text
evento existe?
device existe?
user existe?
associação ativa já existe?
```

## Regra

Falha em qualquer validação deve retornar erro controlado.

---

# 14. TASK-011 — Criar schemas Pydantic

## Objetivo

Definir contratos da API.

## Criar conforme padrão existente

```text
EventCreate
EventUpdate
EventResponse

EventDeviceCreate
EventDeviceUpdate
EventDeviceResponse
```

Caso seja necessário:

```text
EventListResponse
EventDeviceListResponse
```

## Validação

Garantir:

* UUID válido;
* datas válidas;
* campos obrigatórios;
* respostas consistentes.

---

# 15. TASK-012 — Criar API de Events

## Objetivo

Implementar endpoints REST.

## Endpoints

```text
POST   /api/v1/events
GET    /api/v1/events
GET    /api/v1/events/{event_id}
PATCH  /api/v1/events/{event_id}
```

## Validação

Testar:

* sucesso;
* evento inexistente;
* payload inválido;
* datas inválidas.

---

# 16. TASK-013 — Criar API de Devices

## Objetivo

Permitir cadastro operacional.

## Endpoints

Garantir:

```text
POST  /api/v1/devices
GET   /api/v1/devices
GET   /api/v1/devices/{device_id}
PATCH /api/v1/devices/{device_id}
```

Caso endpoints equivalentes já existam:

* reutilizar;
* adaptar;
* não duplicar.

## Regra crítica

O cadastro manual não poderá quebrar o heartbeat.

---

# 17. TASK-014 — Criar API de Event Devices

## Objetivo

Gerenciar equipamentos dentro de eventos.

## Endpoints

```text
GET    /api/v1/events/{event_id}/devices
POST   /api/v1/events/{event_id}/devices
DELETE /api/v1/events/{event_id}/devices/{device_id}
```

Para alteração do responsável:

```text
PATCH /api/v1/events/{event_id}/devices/{device_id}
```

## Validação

Testar:

* associação válida;
* duplicidade;
* evento inexistente;
* device inexistente;
* user inexistente;
* encerramento;
* histórico.

---

# 18. TASK-015 — Dashboard: estrutura de navegação

## Objetivo

Adicionar acesso às áreas:

```text
Eventos
Equipamentos
```

## Regras

Preservar o Dashboard atual.

Não remover a visualização de status existente.

---

# 19. TASK-016 — Dashboard: cadastro e gerenciamento de equipamentos

## Objetivo

Permitir cadastro manual de equipamentos.

## Campos

```text
Patrimônio
Tipo
Fabricante
Modelo
Número de série
Hostname
```

## Tipos iniciais

```text
NOTEBOOK
SMARTPHONE
TABLET
```

## Validação

Após cadastrar:

* equipamento deve aparecer na lista;
* deve permanecer disponível para associação a eventos;
* heartbeat deve continuar funcionando normalmente.

---

# 20. TASK-017 — Dashboard: eventos e associações

## Objetivo

Implementar fluxo operacional de eventos.

## Deve permitir

### Criar evento

```text
Nome
Local
Início
Término
```

### Abrir evento

Visualizar:

```text
Total
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

### Adicionar equipamento

Selecionar equipamentos cadastrados.

### Responsável

Selecionar `user`.

### Remover/encerrar

Encerrar associação sem apagar o equipamento.

---

# 21. TASK-018 — Testes completos e regressão

## Objetivo

Garantir que a Fase 06 não quebrou as Fases 01–05.

## Testes

Executar toda a suíte disponível.

Depois validar manualmente:

```text
PostgreSQL
    ↓
FastAPI
    ↓
Heartbeat
    ↓
StatusMonitor
    ↓
WebSocket
    ↓
Dashboard
    ↓
Telegram
```

## Cenário de teste

Criar dados simulados:

```text
100 equipamentos
10 eventos
20 usuários
```

Criar associações.

Validar:

* múltiplos equipamentos;
* múltiplos eventos;
* múltiplos responsáveis;
* histórico;
* status;
* WebSocket;
* Telegram.

---

# 22. TASK-019 — Review, documentação e preparação do commit

## Objetivo

Finalizar a Fase 06.

## Checklist

Verificar:

```text
[ ] SPEC atendida
[ ] PLAN atendido
[ ] Todas as tasks concluídas
[ ] Testes passando
[ ] Regressão passando
[ ] Migrations funcionando
[ ] Dashboard funcionando
[ ] WebSocket funcionando
[ ] Telegram funcionando
[ ] Sem secrets no Git
[ ] git diff --check sem erros reais
[ ] documentação atualizada
```

## Git

Antes do commit:

```text
git status
git diff --check
git diff --stat
```

Depois:

```text
git add backend dashboard specs/006-events-responsibles
git commit -m "feat: implement events and responsible assignments"
git push origin main
```

O agente não deverá executar `git push` sem verificar primeiro o estado do repositório e confirmar que não existem arquivos ou secrets indevidos.

---

# 23. Critérios finais de aceite

A Fase 06 estará concluída quando o seguinte fluxo funcionar de ponta a ponta:

```text
CRIAR EQUIPAMENTO
        ↓
EQUIPAMENTO NO INVENTÁRIO
        ↓
CRIAR EVENTO
        ↓
ASSOCIAR EQUIPAMENTO
        ↓
ATRIBUIR USER
        ↓
MONITORAR EQUIPAMENTO
        ↓
STATUS EM TEMPO REAL
        ↓
TELEGRAM
```

E também:

```text
EVENTO A
   ↓
NB-001 → User A

EVENTO B
   ↓
NB-001 → User B
```

sem perder o histórico da utilização anterior.

---

# 24. Regra final para o agente

**Não avançar para a Fase 07.**

A Fase 06 deverá ser considerada isoladamente concluída somente após:

```text
IMPLEMENTAÇÃO
    ↓
TESTES
    ↓
REVISÃO
    ↓
DOCUMENTAÇÃO
    ↓
COMMIT
    ↓
PUSH
```

Somente depois disso deverá ser criada a SPEC da Fase 07 — Android.
