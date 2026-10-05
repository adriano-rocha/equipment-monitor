# SPEC-006 — Events + Responsibles

## 1. Identificação

* **Código:** SPEC-006
* **Nome:** Events + Responsibles
* **Fase:** 06
* **Status:** Em especificação
* **Projeto:** Equipment Monitor
* **Dependências:** Fases 01, 02, 03, 04 e 05 concluídas

---

## 2. Objetivo

Implementar o gerenciamento de eventos, responsáveis e a associação dos equipamentos utilizados em cada evento.

A Fase 06 deve transformar o Equipment Monitor de uma aplicação focada apenas no monitoramento individual dos equipamentos em uma aplicação capaz de representar a operação real de equipamentos distribuídos para eventos.

O sistema deverá permitir:

1. cadastrar eventos;
2. cadastrar e consultar equipamentos;
3. associar equipamentos a eventos;
4. associar usuários responsáveis aos equipamentos dentro de um evento;
5. consultar quais equipamentos estão em determinado evento;
6. consultar a qual evento um equipamento está associado;
7. preservar o histórico das associações;
8. permitir que o monitoramento já existente continue funcionando independentemente das associações de evento.

---

## 3. Contexto operacional

O fluxo operacional esperado é:

```text
ESTOQUE
   ↓
EQUIPAMENTOS
   ↓
EVENTO
   ↓
EQUIPAMENTOS SELECIONADOS
   ↓
RESPONSÁVEL (USER)
   ↓
MONITORAMENTO
```

Exemplo:

```text
Evento: Expo Tecnologia 2026

Equipamentos:
- NB-001 — Dell Latitude
- NB-002 — Dell Latitude
- NB-003 — Dell Latitude
- CEL-001 — Samsung Galaxy
- TAB-001 — Samsung Galaxy Tab

Responsáveis:
- User A → NB-001, NB-002
- User B → NB-003
- User C → CEL-001, TAB-001
```

O sistema deve representar esse relacionamento sem transformar `event_id` em atributo fixo do equipamento.

Um equipamento deve poder participar de diferentes eventos ao longo de sua vida operacional.

---

# 4. Escopo

## 4.1 Incluído

### Eventos

O sistema deverá permitir:

* criar evento;
* consultar evento;
* listar eventos;
* atualizar evento;
* ativar/desativar evento conforme regra definida no PLAN;
* identificar período do evento;
* identificar local do evento;
* consultar equipamentos associados;
* consultar responsáveis associados.

### Equipamentos

A Fase 06 deverá fornecer a estrutura necessária para o cadastro operacional dos equipamentos.

O cadastro deverá contemplar, no mínimo:

* patrimônio (`asset_number`);
* tipo do equipamento;
* fabricante;
* modelo;
* número de série, quando disponível;
* hostname, quando aplicável;
* informações necessárias para identificação;
* status operacional derivado do monitoramento existente.

O cadastro não deve substituir nem quebrar o mecanismo de heartbeat da Fase 05.

### Usuários responsáveis

O responsável operacional será representado por um `user`.

Nesta fase não será criado um cadastro separado de funcionário/colaborador.

O usuário deverá poder ser associado a equipamentos dentro do contexto de um evento.

### Associação equipamento ↔ evento

Um equipamento poderá participar de vários eventos ao longo do tempo.

A associação deverá ser histórica.

Exemplo:

```text
NB-001
   │
   ├── Evento A
   ├── Evento B
   └── Evento C
```

Não deve existir uma coluna simples `event_id` em `devices` como solução para esse relacionamento.

Deverá existir uma estrutura intermediária, conforme definido na arquitetura:

```text
event_devices
```

### Associação responsável ↔ equipamento/evento

A responsabilidade deverá existir dentro do contexto operacional do evento.

Exemplo:

```text
Evento A
   │
   ├── NB-001 → User A
   ├── NB-002 → User A
   └── CEL-001 → User B
```

A modelagem final deverá evitar ambiguidades quando o mesmo equipamento participar de eventos diferentes com responsáveis diferentes.

---

# 5. Fora do escopo

A Fase 06 NÃO deverá implementar:

* aplicativo Android;
* gerenciamento Android Enterprise;
* Google Management;
* recuperação Android;
* rastreamento GPS;
* hardware tracker;
* segurança avançada específica Dell;
* MDM;
* bloqueio remoto;
* wipe remoto;
* geolocalização;
* autenticação JWT completa, caso ainda não esteja implementada;
* integração com sistemas externos de estoque/ERP;
* sincronização automática com sistemas do cliente;
* reconhecimento de roubo/furto;
* classificação de equipamento como "roubado".

O sistema continuará utilizando apenas:

```text
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

para o estado de comunicação.

---

# 6. Requisitos funcionais

## RF-001 — Criar evento

O sistema deverá permitir criar um evento informando os dados obrigatórios definidos pela API.

O evento deverá possuir identificação única.

---

## RF-002 — Listar eventos

O sistema deverá permitir consultar os eventos cadastrados.

A listagem deverá permitir identificar pelo menos:

* nome;
* local;
* início;
* término;
* status operacional, quando aplicável.

---

## RF-003 — Consultar evento

O sistema deverá permitir consultar os detalhes de um evento específico.

A consulta deverá possibilitar visualizar:

* dados do evento;
* equipamentos associados;
* responsáveis associados;
* situação das associações.

---

## RF-004 — Atualizar evento

O sistema deverá permitir alterar dados editáveis do evento sem perder seu histórico de utilização.

---

## RF-005 — Cadastrar equipamento

O sistema deverá permitir cadastrar equipamentos manualmente.

O patrimônio deverá ser identificável e não deverá ser utilizado como chave primária do banco.

A identidade interna do equipamento continuará sendo baseada no identificador técnico apropriado já existente na arquitetura.

---

## RF-006 — Listar equipamentos

O sistema deverá permitir consultar os equipamentos cadastrados.

A listagem deverá ser compatível com dezenas ou centenas de equipamentos.

---

## RF-007 — Associar equipamento a evento

O sistema deverá permitir selecionar equipamentos cadastrados e associá-los a um evento.

O mesmo equipamento poderá participar de diferentes eventos ao longo do tempo.

---

## RF-008 — Remover equipamento de evento

O sistema deverá permitir encerrar/remover a associação operacional de um equipamento com um evento sem apagar o equipamento do cadastro geral.

O histórico da associação não deverá ser destruído quando isso for necessário para preservar rastreabilidade.

---

## RF-009 — Associar responsável

O sistema deverá permitir associar um `user` a um equipamento dentro de determinado evento.

---

## RF-010 — Alterar responsável

O sistema deverá permitir substituir o responsável operacional de uma associação sem alterar o cadastro permanente do equipamento.

---

## RF-011 — Consultar equipamentos de um evento

O sistema deverá permitir visualizar todos os equipamentos vinculados a determinado evento.

Cada equipamento deverá continuar apresentando seu estado de comunicação atual:

```text
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

---

## RF-012 — Consultar responsável

O sistema deverá permitir identificar o `user` responsável por determinado equipamento dentro do evento.

---

## RF-013 — Preservar monitoramento

A associação a eventos e responsáveis não deverá interferir no recebimento de heartbeat.

O equipamento continuará enviando heartbeat independentemente de estar associado ou não a um evento.

---

## RF-014 — Preservar histórico

A exclusão lógica ou encerramento de uma associação não deverá apagar o histórico necessário para auditoria operacional.

---

# 7. Requisitos de dados

A modelagem deverá considerar, no mínimo, as seguintes entidades:

```text
users
devices
events
event_devices
```

Caso a modelagem de responsáveis exija uma entidade associativa adicional, isso deverá ser definido no `plan.md` com justificativa arquitetural.

### Regra importante

Não criar:

```text
devices.event_id
```

como mecanismo principal de associação.

A relação deve suportar:

```text
Device N:N Event
```

por meio de uma tabela associativa.

---

# 8. Regras de negócio

## RN-001 — Patrimônio

`asset_number` identifica operacionalmente o patrimônio, mas não é a chave primária do equipamento.

---

## RN-002 — Equipamento pode participar de múltiplos eventos

Um mesmo equipamento poderá ser utilizado em eventos diferentes ao longo do tempo.

---

## RN-003 — Histórico

A associação entre equipamento e evento deve poder ser rastreada historicamente.

---

## RN-004 — Responsável contextual

Um `user` responsável por um equipamento em um evento não implica que esse usuário seja permanentemente responsável pelo equipamento.

---

## RN-005 — Monitoramento independente

O estado de comunicação do equipamento é calculado pelo backend com base no heartbeat.

A associação com evento não altera as regras:

```text
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

---

## RN-006 — Sem associação não significa offline

Um equipamento cadastrado que não esteja associado a um evento continuará sendo um equipamento válido do inventário.

Sua ausência de associação não deverá ser interpretada como falha de comunicação.

---

## RN-007 — Equipamento inexistente

Não deverá ser possível criar uma associação com um equipamento inexistente.

---

## RN-008 — Evento inexistente

Não deverá ser possível criar uma associação com um evento inexistente.

---

## RN-009 — Usuário inexistente

Não deverá ser possível atribuir um responsável que não exista.

---

## RN-010 — Duplicidade

O sistema deverá impedir associações duplicadas que representem exatamente o mesmo vínculo ativo.

---

# 9. API

A Fase 06 deverá criar endpoints REST seguindo o padrão já existente em:

```text
/api/v1
```

A API deverá contemplar operações para:

```text
/events
/devices
/events/{event_id}/devices
/events/{event_id}/...
```

Os endpoints exatos, métodos HTTP, schemas e códigos de resposta serão definidos no `plan.md`.

A implementação deverá respeitar a arquitetura existente:

```text
API
 ↓
Application / Services
 ↓
Repositories
 ↓
PostgreSQL
```

Não deverá ser criada lógica de negócio complexa diretamente dentro dos routers.

---

# 10. Dashboard

A Fase 06 deverá evoluir o Dashboard para permitir gerenciamento operacional.

A interface deverá caminhar para algo semelhante a:

```text
┌─────────────────────────────────────────────┐
│ EQUIPMENT MONITOR                           │
├─────────────────────────────────────────────┤
│                                             │
│ Eventos                                     │
│                                             │
│ [+ Novo Evento]                             │
│                                             │
│ Expo Tecnologia 2026                       │
│ Expo SP                                     │
│ 15/10/2026 - 18/10/2026                    │
│                                             │
└─────────────────────────────────────────────┘
```

Ao abrir o evento:

```text
┌─────────────────────────────────────────────┐
│ Expo Tecnologia 2026                       │
├─────────────────────────────────────────────┤
│                                             │
│ Total: 45                                   │
│ ONLINE: 40                                  │
│ SEM COMUNICAÇÃO: 3                          │
│ OFFLINE: 2                                  │
│                                             │
│ [+ Adicionar equipamento]                   │
│                                             │
│ Patrimônio   Tipo        Responsável Status │
│ NB-001       Notebook    User A       ONLINE│
│ NB-002       Notebook    User A       ONLINE│
│ CEL-001      Smartphone  User B       OFFLINE│
│ TAB-001      Tablet      User C       ONLINE│
│                                             │
└─────────────────────────────────────────────┘
```

O desenho visual poderá ser refinado durante o PLAN/IMPLEMENT.

---

# 11. Dados de teste

Como o desenvolvimento ocorre remotamente e os equipamentos físicos podem não estar disponíveis, a Fase 06 deverá ser validável utilizando dados simulados.

Deverá ser possível trabalhar com cenários como:

```text
30 notebooks
10 smartphones
5 tablets
```

ou mais.

Os dados simulados deverão permitir validar:

* múltiplos eventos;
* múltiplos equipamentos;
* múltiplos responsáveis;
* equipamentos sem evento;
* equipamentos presentes em diferentes eventos ao longo do tempo;
* diferentes estados de comunicação.

Nenhum equipamento físico será requisito para concluir a implementação da Fase 06.

---

# 12. Compatibilidade com Fases anteriores

A implementação deverá preservar integralmente as funcionalidades já existentes.

Especialmente:

### Fase 02

* PostgreSQL;
* SQLAlchemy;
* Alembic;
* repositories;
* estrutura FastAPI.

### Fase 03

* Windows Agent;
* endpoint de heartbeat;
* autenticação do device;
* coleta de informações.

### Fase 04

* Dashboard existente;
* listagem de equipamentos;
* visualização dos estados.

### Fase 05

* WebSocket;
* StatusMonitor;
* cálculo de status;
* Telegram;
* transições de estado.

Nenhuma dessas funcionalidades deverá ser removida ou quebrada.

---

# 13. Segurança

A Fase 06 deverá respeitar as práticas já estabelecidas:

* validação de entrada;
* secrets exclusivamente por ambiente;
* não expor credenciais;
* não armazenar secrets diretamente no código;
* validação dos IDs recebidos pela API;
* tratamento adequado de recursos inexistentes;
* não confiar em dados enviados pelo frontend para determinar status do equipamento.

A implementação de autenticação/autorização completa deverá permanecer limitada ao escopo já definido pelo projeto e não deverá ser artificialmente expandida nesta fase.

---

# 14. Critérios de aceite

A Fase 06 será considerada funcionalmente concluída quando for possível:

### Eventos

* [ ] Criar evento.
* [ ] Listar eventos.
* [ ] Consultar evento.
* [ ] Atualizar evento.

### Equipamentos

* [ ] Criar equipamento.
* [ ] Listar equipamentos.
* [ ] Consultar equipamento.
* [ ] Preservar o heartbeat existente.

### Associação

* [ ] Associar equipamento a evento.
* [ ] Visualizar equipamentos do evento.
* [ ] Encerrar/remover associação.
* [ ] Preservar histórico.
* [ ] Associar `user` responsável.
* [ ] Alterar responsável.

### Monitoramento

* [ ] Equipamentos do evento exibem `ONLINE`.
* [ ] Equipamentos do evento exibem `SEM COMUNICAÇÃO`.
* [ ] Equipamentos do evento exibem `OFFLINE`.
* [ ] WebSocket continua funcionando.
* [ ] Telegram continua funcionando.
* [ ] Heartbeat continua funcionando.

### Escala simulada

* [ ] Testar dezenas de equipamentos.
* [ ] Testar múltiplos eventos.
* [ ] Testar múltiplos responsáveis.
* [ ] Testar equipamento participando de eventos diferentes.

---

# 15. Testes mínimos

A implementação deverá incluir testes para:

1. criação de evento;
2. consulta de evento;
3. atualização de evento;
4. criação de equipamento;
5. associação equipamento/evento;
6. associação de responsável;
7. alteração de responsável;
8. prevenção de associação duplicada;
9. tentativa de associação com equipamento inexistente;
10. tentativa de associação com evento inexistente;
11. preservação do heartbeat;
12. preservação do status;
13. consulta dos equipamentos de um evento;
14. encerramento de associação;
15. preservação do histórico.

---

# 16. Observabilidade

Erros de API deverão ser registrados adequadamente.

Falhas relacionadas a eventos ou associações não deverão derrubar o monitoramento de heartbeat.

O funcionamento do:

```text
Heartbeat
StatusMonitor
WebSocket
Telegram
```

deve permanecer independente das operações de gerenciamento de eventos.

---

# 17. Restrições arquiteturais

A implementação deverá:

* respeitar a arquitetura atual;
* reutilizar repositories existentes quando apropriado;
* evitar duplicação de lógica;
* utilizar migrations Alembic;
* manter separação entre domínio, aplicação, infraestrutura e interface;
* não introduzir Redis;
* não introduzir Celery;
* não introduzir RabbitMQ;
* não introduzir Kafka;
* não adicionar infraestrutura externa sem necessidade;
* não implementar funcionalidades da Fase 07 antecipadamente.

---

# 18. Resultado esperado

Ao final da Fase 06, o Equipment Monitor deverá ser capaz de representar uma operação semelhante a:

```text
EVENTO
│
├── NB-001
│   └── User A
│
├── NB-002
│   └── User A
│
├── NB-003
│   └── User B
│
├── CEL-001
│   └── User C
│
└── TAB-001
    └── User C
```

Enquanto o monitoramento continuará funcionando em paralelo:

```text
NB-001 → ONLINE
NB-002 → ONLINE
NB-003 → SEM COMUNICAÇÃO
CEL-001 → ONLINE
TAB-001 → OFFLINE
```

O sistema deverá, portanto, combinar:

```text
INVENTÁRIO
    +
EVENTOS
    +
RESPONSÁVEIS
    +
MONITORAMENTO EM TEMPO REAL
```

sem depender de equipamentos físicos para validação da Fase 06.

---

# 19. Próximo passo

Após a aprovação desta SPEC:

```text
SPEC-006
   ↓
PLAN-006
   ↓
TASKS-006
   ↓
IMPLEMENTAÇÃO
   ↓
TESTES
   ↓
REVIEW
   ↓
COMMIT + PUSH
```

O `plan.md` deverá detalhar a modelagem final do banco, migrations, endpoints, services, repositories, Dashboard e estratégia de testes antes de qualquer implementação.
