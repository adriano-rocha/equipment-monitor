# PLAN-006 — Events + Responsibles

## 1. Identificação

* **Código:** PLAN-006
* **Nome:** Events + Responsibles
* **Fase:** 06
* **SPEC:** `specs/006-events-responsibles/spec.md`
* **Status:** Planejamento
* **Dependências:** Fases 01–05 concluídas

---

# 2. Objetivo do plano

Definir a estratégia técnica para implementar a Fase 06 do Equipment Monitor, adicionando:

```text
Eventos
+
Cadastro de equipamentos
+
Usuários responsáveis
+
Relacionamento equipamento ↔ evento
+
Responsável contextual
+
Dashboard operacional
```

A implementação deverá preservar integralmente:

```text
Heartbeat
StatusMonitor
WebSocket
Telegram
Windows Agent
```

já existentes.

---

# 3. Estratégia geral

A implementação será realizada em incrementos verticais:

```text
Banco
  ↓
Models
  ↓
Migration
  ↓
Repositories
  ↓
Services
  ↓
Schemas
  ↓
API
  ↓
Dashboard
  ↓
Testes
```

Cada incremento deverá ser funcional e testável antes do próximo.

Não será feita uma grande alteração monolítica no projeto.

---

# 4. Modelo de domínio

A Fase 06 trabalhará inicialmente com:

```text
User
Device
Event
EventDevice
```

Relacionamento:

```text
User
 │
 │ responsável
 ▼
EventDevice
 ▲
 │
 │ associação
 │
Device
 │
 │
 ▼
Event
```

A entidade `EventDevice` será o ponto central da associação operacional.

---

# 5. Modelagem proposta

## 5.1 User

A entidade `users` será utilizada como responsável operacional.

A implementação deverá primeiro verificar a existência da estrutura de usuários no projeto atual antes de criar qualquer nova tabela.

Caso `users` já exista:

* reutilizar;
* não duplicar a entidade;
* respeitar seu modelo atual.

Caso ainda não exista:

* criar a estrutura mínima necessária;
* evitar implementar autenticação completa nesta fase;
* preparar a entidade para futura autenticação/autorização.

Campos mínimos esperados:

```text
id
name
email
created_at
updated_at
```

Os nomes finais deverão respeitar o padrão já utilizado pelo projeto.

---

# 6. Event

Criar entidade `events`.

Campos previstos:

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

### Regras

* `id` será UUID;
* `name` obrigatório;
* `location` obrigatório;
* `starts_at` obrigatório;
* `ends_at` obrigatório;
* `ends_at` deverá ser posterior a `starts_at`;
* timestamps deverão ser timezone-aware;
* `is_active` será utilizado para controle operacional.

O PLAN não deve introduzir um campo de "status" redundante caso o status possa ser derivado de `is_active` e das datas.

---

# 7. Device

O modelo existente de `Device` será preservado.

A Fase 06 deverá apenas verificar se são necessários campos adicionais para o cadastro operacional.

Campos de inventário esperados:

```text
id
asset_number
device_type
manufacturer
model
serial_number
hostname
```

Campos relacionados ao monitoramento, como:

```text
reported_ip
battery_level
last_seen
```

continuarão pertencendo ao fluxo já existente.

O status:

```text
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

não será persistido como verdade primária no cadastro.

Ele continuará sendo calculado pelo backend.

---

# 8. EventDevice

Criar tabela:

```text
event_devices
```

Esta será a tabela associativa entre eventos e equipamentos.

Estrutura conceitual:

```text
event_devices
-------------------------
id
event_id
device_id
assigned_user_id
assigned_at
unassigned_at
created_at
updated_at
```

### Observação importante

A modelagem deverá ser validada durante a implementação para determinar se `assigned_user_id` deve permanecer diretamente em `event_devices` ou se será necessária uma entidade específica para histórico de responsáveis.

Para o MVP, a preferência é manter o modelo simples, desde que seja possível preservar o histórico exigido pela SPEC.

---

# 9. Histórico

A associação deverá suportar histórico.

Exemplo:

```text
NB-001
   │
   ├── Evento A
   │     └── User A
   │
   ├── Evento B
   │     └── User B
   │
   └── Evento C
         └── User A
```

Não deverá existir atualização destrutiva que apague a utilização anterior.

Para isso:

```text
assigned_at
unassigned_at
```

serão utilizados quando apropriado.

Uma associação ativa terá:

```text
unassigned_at = NULL
```

Uma associação encerrada terá:

```text
unassigned_at = timestamp
```

---

# 10. Integridade do banco

Deverão ser criadas constraints e índices adequados.

No mínimo:

### Foreign keys

```text
event_devices.event_id
    → events.id

event_devices.device_id
    → devices.id

event_devices.assigned_user_id
    → users.id
```

### Índices

Avaliar índices para:

```text
events.starts_at
events.is_active
event_devices.event_id
event_devices.device_id
event_devices.assigned_user_id
```

### Unicidade

A regra de duplicidade deverá impedir duas associações simultaneamente ativas para o mesmo:

```text
event + device
```

A implementação deverá utilizar uma estratégia compatível com PostgreSQL e Alembic.

---

# 11. Migrations

Criar migration Alembic específica da Fase 06.

A migration deverá:

1. criar `events`;
2. criar `event_devices`;
3. criar `users` somente se necessário;
4. adicionar campos de inventário em `devices` somente se realmente necessários;
5. criar foreign keys;
6. criar índices;
7. criar constraints;
8. possuir downgrade funcional.

Não alterar migrations antigas.

---

# 12. Repositories

Criar/reutilizar repositories seguindo a arquitetura existente.

Possíveis componentes:

```text
SqlAlchemyEventRepository
SqlAlchemyDeviceRepository
SqlAlchemyUserRepository
SqlAlchemyEventDeviceRepository
```

Os repositories deverão ser responsáveis por persistência e consultas.

Não colocar regras de negócio complexas nos repositories.

---

# 13. Application Services

Criar services para as operações principais.

Estrutura esperada:

```text
application/services/
    event_service.py
    event_device_service.py
```

Caso o projeto já possua uma estrutura equivalente, reutilizar o padrão existente.

### EventService

Responsabilidades:

* criar evento;
* consultar evento;
* listar eventos;
* atualizar evento;
* validar datas.

### EventDeviceService

Responsabilidades:

* associar equipamento;
* remover/encerrar associação;
* atribuir responsável;
* alterar responsável;
* consultar equipamentos do evento;
* validar duplicidade;
* validar existência das entidades relacionadas.

---

# 14. Schemas

Criar schemas Pydantic específicos.

Exemplo conceitual:

```text
EventCreate
EventUpdate
EventResponse
EventListResponse

EventDeviceCreate
EventDeviceResponse
EventDeviceUpdate
```

Os schemas deverão validar:

* campos obrigatórios;
* UUIDs;
* datas;
* valores inválidos;
* estruturas de resposta.

Não expor diretamente modelos SQLAlchemy através da API.

---

# 15. API REST

Criar endpoints sob:

```text
/api/v1
```

## Eventos

```text
POST   /events
GET    /events
GET    /events/{event_id}
PATCH  /events/{event_id}
```

## Equipamentos

Preservar:

```text
GET /devices
```

Adicionar endpoint de criação:

```text
POST /devices
```

e, se necessário para o Dashboard:

```text
GET /devices/{device_id}
PATCH /devices/{device_id}
```

## Equipamentos do evento

```text
GET    /events/{event_id}/devices
POST   /events/{event_id}/devices
DELETE /events/{event_id}/devices/{device_id}
```

## Responsável

Preferencialmente:

```text
PATCH /events/{event_id}/devices/{device_id}
```

para atualizar o `assigned_user_id`.

Evitar criar endpoints excessivamente fragmentados sem necessidade.

---

# 16. Tratamento de erros

A API deverá retornar respostas consistentes.

Exemplos:

```text
404
Evento não encontrado.

404
Equipamento não encontrado.

404
Usuário não encontrado.

409
Equipamento já associado ao evento.

422
Dados inválidos.
```

Os handlers deverão seguir o padrão já existente no projeto.

---

# 17. Dashboard

O Dashboard será evoluído incrementalmente.

## Etapa 1 — Navegação

Adicionar uma área para:

```text
Eventos
Equipamentos
```

## Etapa 2 — Lista de eventos

Mostrar:

```text
Nome
Local
Início
Término
Situação
```

## Etapa 3 — Criar evento

Formulário:

```text
Nome
Local
Data/hora inicial
Data/hora final
```

## Etapa 4 — Detalhes do evento

Mostrar:

```text
Informações do evento
+
Equipamentos associados
+
Responsáveis
+
Status em tempo real
```

## Etapa 5 — Adicionar equipamento

Permitir selecionar equipamentos cadastrados.

## Etapa 6 — Responsável

Permitir selecionar um `user`.

---

# 18. Realtime no Dashboard

A integração WebSocket existente deverá ser preservada.

Quando um equipamento associado ao evento mudar de status:

```text
ONLINE
↓
SEM COMUNICAÇÃO
```

ou:

```text
SEM COMUNICAÇÃO
↓
OFFLINE
```

o Dashboard deverá refletir a alteração.

A Fase 06 não deverá criar um segundo mecanismo de WebSocket.

---

# 19. Cadastro de equipamentos

O Dashboard deverá ganhar uma forma de cadastro manual.

Exemplo:

```text
Novo equipamento

Patrimônio: NB-004
Tipo: Notebook
Fabricante: Dell
Modelo: Latitude 5420
Número de série: XXXXX
Hostname: NB-004
```

O cadastro deverá ser separado da associação ao evento.

Assim:

```text
CADASTRAR EQUIPAMENTO
        ↓
EQUIPAMENTO EXISTE NO INVENTÁRIO
        ↓
ASSOCIAR AO EVENTO
```

Isso permite que um equipamento exista no sistema antes de ser utilizado em um evento.

---

# 20. Tipos de equipamento

Para o MVP, considerar:

```text
NOTEBOOK
SMARTPHONE
TABLET
```

A implementação deverá evitar lógica excessivamente rígida que impeça a inclusão futura de outros tipos.

A estratégia final:

* enum;
* tabela de referência;
* ou string controlada

deverá ser escolhida durante a implementação com base no padrão atual do projeto.

---

# 21. Dados simulados

Criar estratégia de seed/dados de desenvolvimento.

Exemplo:

```text
Eventos:
- Expo Tecnologia 2026
- Evento Corporativo 2026
- Feira ABC 2026

Equipamentos:
- 30 notebooks
- 10 smartphones
- 5 tablets

Usuários:
- User A
- User B
- User C
```

Esses dados deverão ser utilizados para validar o comportamento do sistema sem depender de equipamentos físicos.

Os dados de desenvolvimento não deverão ser utilizados como dados reais de produção.

---

# 22. Testes de backend

Criar testes para:

### Events

* criação;
* listagem;
* consulta;
* atualização;
* validação de datas;
* evento inexistente.

### Devices

* criação;
* consulta;
* patrimônio;
* duplicidade de patrimônio, se essa regra já existir;
* preservação do heartbeat.

### EventDevice

* associação;
* consulta;
* encerramento;
* duplicidade;
* equipamento inexistente;
* evento inexistente;
* usuário inexistente.

### Responsável

* atribuição;
* alteração;
* remoção, se suportada;
* histórico.

---

# 23. Testes de integração

Validar:

```text
Device
   ↓
Heartbeat
   ↓
PostgreSQL
   ↓
StatusMonitor
   ↓
WebSocket
```

depois da introdução das novas entidades.

Também validar:

```text
Event
   ↓
EventDevice
   ↓
Device
```

e:

```text
EventDevice
   ↓
User
```

---

# 24. Teste de regressão da Fase 05

Obrigatório.

Após implementar a Fase 06, repetir pelo menos:

1. iniciar PostgreSQL;
2. iniciar backend;
3. iniciar Dashboard;
4. executar heartbeat;
5. verificar `ONLINE`;
6. simular transição;
7. verificar WebSocket;
8. verificar Telegram;
9. confirmar que eventos/associações não interferem no monitoramento.

---

# 25. Teste de volume

Simular:

```text
100 equipamentos
10 eventos
20 usuários
```

e associações suficientes para representar uma operação realista.

O objetivo inicial não será teste de carga extremo.

O objetivo será confirmar que a modelagem e as consultas continuam adequadas para dezenas/centenas de equipamentos.

---

# 26. Ordem de implementação

A ordem recomendada é:

```text
1. Revisar models existentes
        ↓
2. Definir User
        ↓
3. Criar Event model
        ↓
4. Criar EventDevice model
        ↓
5. Criar migration
        ↓
6. Atualizar repositories
        ↓
7. Criar services
        ↓
8. Criar schemas
        ↓
9. Criar endpoints
        ↓
10. Testar API
        ↓
11. Implementar cadastro de equipamentos
        ↓
12. Implementar gerenciamento de eventos
        ↓
13. Implementar associação equipamento/evento
        ↓
14. Implementar responsável
        ↓
15. Integrar Dashboard
        ↓
16. Testar WebSocket
        ↓
17. Testar Telegram
        ↓
18. Teste de regressão
        ↓
19. Review
```

---

# 27. Arquivos esperados

A estrutura final deverá permanecer coerente com o projeto atual.

Possíveis novos arquivos:

```text
backend/app/domain/models/event.py
backend/app/domain/models/event_device.py

backend/app/application/services/event_service.py
backend/app/application/services/event_device_service.py

backend/app/infrastructure/db/repositories/sqlalchemy_event_repository.py
backend/app/infrastructure/db/repositories/sqlalchemy_event_device_repository.py

backend/app/interface/api/v1/events.py
backend/app/interface/api/v1/schemas/event_schema.py

dashboard/src/pages/Events.jsx
dashboard/src/pages/EventDetails.jsx
dashboard/src/pages/Devices.jsx
```

**Importante:** esses caminhos são uma proposta de organização. Antes de criar arquivos, o agente deverá verificar a estrutura real existente e reutilizar padrões já estabelecidos.

Não criar arquivos duplicados apenas para seguir este exemplo.

---

# 28. Compatibilidade arquitetural

A implementação deverá manter:

```text
React/Vite
      ↓
REST / WebSocket
      ↓
FastAPI
      ↓
Application Services
      ↓
Repositories
      ↓
SQLAlchemy
      ↓
PostgreSQL
```

O Dashboard não deverá acessar PostgreSQL diretamente.

---

# 29. Regras de não regressão

A implementação não poderá:

* remover heartbeat;
* alterar o contrato do heartbeat sem necessidade;
* alterar as regras de status;
* remover WebSocket;
* remover Telegram;
* introduzir polling adicional;
* colocar lógica de status no frontend;
* transformar `asset_number` em primary key;
* criar `devices.event_id`;
* adicionar infraestrutura externa sem necessidade.

---

# 30. Estratégia de entrega

A Fase 06 será implementada em pequenos blocos.

### Bloco A

Banco + models + migration.

### Bloco B

Repositories + services.

### Bloco C

Schemas + API.

### Bloco D

Cadastro de equipamentos.

### Bloco E

Eventos.

### Bloco F

Associação equipamento/evento.

### Bloco G

Responsáveis.

### Bloco H

Dashboard.

### Bloco I

Testes + regressão.

### Bloco J

Review + documentação + commit.

---

# 31. Critério de conclusão técnica

A Fase 06 somente será considerada concluída quando:

```text
Eventos
        ✅
Equipamentos
        ✅
Users
        ✅
EventDevice
        ✅
CRUD
        ✅
Associações
        ✅
Responsáveis
        ✅
Histórico
        ✅
Dashboard
        ✅
WebSocket
        ✅
Telegram
        ✅
Testes
        ✅
Regressão
        ✅
```

estiverem funcionando conjuntamente.

---

# 32. Próximo passo

Após este `plan.md`, deverá ser criado:

```text
specs/006-events-responsibles/tasks.md
```

O `tasks.md` deverá converter este plano em tarefas pequenas, executáveis e verificáveis pelo agente de implementação.

Nenhuma implementação deverá começar antes da definição das tasks.
