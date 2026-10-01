# TASKS-003 — Realtime + Telegram

## 0. Contexto

Esta é a Fase 05 do projeto `equipment-monitor`.

Documentos de referência:

```text
specs/003-realtime-telegram/
├── spec.md
├── plan.md
└── tasks.md
```

Documentos anteriores e código existente são parte da fonte de verdade do projeto.

A implementação deve seguir:

```text
SPEC
  ↓
PLAN
  ↓
TASKS
  ↓
IMPLEMENT
  ↓
TEST
  ↓
REVIEW
  ↓
COMMIT
```

### Estratégia desta fase

> **Fazer funcionar rápido → testar tudo no final → validar → commit → próxima fase.**

Não antecipar complexidade que não seja necessária para o MVP.

---

# 1. Regras obrigatórias para o agente

Antes de implementar qualquer tarefa:

* [ ] Ler `AGENTS.md`.
* [ ] Ler `CLAUDE.md`.
* [ ] Ler `PROJECT-CONTEXT.md`.
* [ ] Ler `specs/003-realtime-telegram/spec.md`.
* [ ] Ler `specs/003-realtime-telegram/plan.md`.
* [ ] Inspecionar a implementação existente.
* [ ] Identificar como as fases anteriores implementaram services, repositories, schemas, models, configurações e testes.
* [ ] Identificar e analisar `device_status_service.py`.
* [ ] Não criar arquitetura paralela.
* [ ] Não duplicar regras existentes.
* [ ] Não modificar funcionalidades anteriores sem necessidade.
* [ ] Não introduzir dependências desnecessárias.

### Regra principal

Se alguma implementação existente já resolve parcialmente uma tarefa, **reutilizar e adaptar antes de criar algo novo**.

---

# 2. Estado esperado antes da implementação

As fases anteriores já possuem:

* backend FastAPI;
* banco PostgreSQL;
* heartbeat;
* persistência de heartbeat;
* identificação de dispositivos;
* cálculo/controle de status;
* Dashboard;
* autenticação/RBAC;
* Docker;
* migrations Alembic.

O agente deve confirmar o estado real do repositório antes de assumir qualquer detalhe.

Não considerar esta lista como substituta da inspeção do código.

---

# 3. Fase A — Inspeção inicial

## TASK-003-001 — Ler documentação da fase

* [ ] Ler `spec.md`.
* [ ] Ler `plan.md`.
* [ ] Identificar requisitos funcionais.
* [ ] Identificar requisitos técnicos.
* [ ] Identificar itens explicitamente fora do escopo.
* [ ] Identificar critérios de aceite.

### Resultado

O agente deve compreender exatamente o que precisa ser implementado antes de alterar código.

---

## TASK-003-002 — Inspecionar arquitetura atual

Inspecionar:

```text
backend/
dashboard/
docs/
specs/
```

Identificar:

* [ ] estrutura de API;
* [ ] routers;
* [ ] services;
* [ ] repositories;
* [ ] models;
* [ ] schemas;
* [ ] configuração;
* [ ] testes;
* [ ] integração existente entre heartbeat e status.

### Resultado

Registrar mentalmente/na execução quais componentes existentes serão reutilizados.

Não criar documentação adicional apenas para cumprir esta tarefa.

---

## TASK-003-003 — Inspecionar `device_status_service.py`

Analisar especificamente:

* [ ] como o status atual é calculado;
* [ ] quais estados são permitidos;
* [ ] como o estado anterior é obtido;
* [ ] onde ocorre alteração de status;
* [ ] como o serviço é chamado;
* [ ] se existe algum mecanismo atual de evento;
* [ ] se já existe estrutura que possa ser reutilizada para WebSocket/Telegram.

### Regra

Não duplicar a lógica de status.

O `device_status_service.py` deve continuar sendo a referência para a determinação de status, salvo necessidade identificada na implementação.

---

# 4. Fase B — Configuração

## TASK-003-004 — Inspecionar configuração existente

Verificar:

* [ ] `settings`;
* [ ] `.env`;
* [ ] `.env.example`;
* [ ] padrão de carregamento de variáveis;
* [ ] configuração de ambiente utilizada pelo Docker.

Não criar novo sistema de configuração.

---

## TASK-003-005 — Adicionar configuração Telegram

Adicionar somente as variáveis necessárias conforme `spec.md`.

Exemplo conceitual:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ENABLED=true
```

Os nomes finais devem respeitar o padrão já existente no projeto.

### Regras

* [ ] Nunca colocar token real no código.
* [ ] Nunca colocar token real no `.env.example`.
* [ ] Nunca versionar segredo.
* [ ] Utilizar o sistema de configuração existente.

---

## TASK-003-006 — Atualizar `.env.example`

Adicionar:

* [ ] token;
* [ ] chat ID;
* [ ] flag de habilitação, caso definida pela SPEC.

Documentar brevemente o propósito de cada variável se esse for o padrão atual do projeto.

---

# 5. Fase C — WebSocket Manager

## TASK-003-007 — Definir mecanismo de conexões

Implementar mecanismo simples para:

* [ ] registrar conexão;
* [ ] remover conexão;
* [ ] identificar conexões ativas;
* [ ] enviar mensagem para uma conexão;
* [ ] fazer broadcast;
* [ ] tratar desconexão.

Não implementar:

* [ ] Redis;
* [ ] RabbitMQ;
* [ ] Kafka;
* [ ] broker externo;
* [ ] escalabilidade distribuída.

---

## TASK-003-008 — Criar/reutilizar WebSocket Manager

Criar o componente somente se não existir equivalente.

Responsabilidades:

```text
connect()
disconnect()
broadcast()
```

ou equivalente compatível com a arquitetura atual.

### Regras

* [ ] Não colocar regra de negócio de status no manager.
* [ ] Não acessar banco diretamente.
* [ ] Não conhecer detalhes do Telegram.
* [ ] Não acoplar ao Dashboard.

---

## TASK-003-009 — Tratar falha de conexão

Garantir:

* [ ] conexão encerrada não quebra o servidor;
* [ ] cliente desconectado é removido;
* [ ] broadcast continua funcionando para os demais clientes;
* [ ] exceções são tratadas adequadamente.

---

# 6. Fase D — Endpoint WebSocket

## TASK-003-010 — Criar/reutilizar endpoint

Criar ou adaptar endpoint WebSocket conforme arquitetura existente.

Endpoint conceitual:

```text
/ws
```

O caminho final deve respeitar o padrão da API.

---

## TASK-003-011 — Implementar ciclo de conexão

O endpoint deve:

1. aceitar conexão;
2. registrar conexão;
3. permanecer disponível;
4. tratar desconexão;
5. remover conexão;
6. não bloquear o restante da aplicação.

---

## TASK-003-012 — Verificar autenticação

Verificar como a aplicação atual trata autenticação nos endpoints.

Caso a SPEC exija autenticação no WebSocket:

* [ ] implementar conforme padrão existente;
* [ ] não criar mecanismo paralelo;
* [ ] respeitar RBAC quando aplicável.

Caso a SPEC não exija autenticação específica:

* [ ] não inventar mecanismo adicional.

---

# 7. Fase E — Evento de status

## TASK-003-013 — Definir schema do evento

Criar/reutilizar schema para evento de alteração de status.

Formato conceitual:

```json
{
  "event": "device_status_changed",
  "device_id": "...",
  "asset_number": "...",
  "status": "ONLINE",
  "timestamp": "..."
}
```

O formato definitivo deve seguir a SPEC e os schemas existentes.

---

## TASK-003-014 — Validar campos do evento

Confirmar:

* [ ] identificação do dispositivo;
* [ ] `asset_number`, quando aplicável;
* [ ] status;
* [ ] timestamp;
* [ ] tipo do evento.

Não utilizar `asset_number` como chave primária do dispositivo.

---

## TASK-003-015 — Validar estados permitidos

Garantir que o evento utilize somente:

```text
ONLINE
SEM_COMUNICACAO
OFFLINE
```

Não adicionar:

```text
ROUBADO
STOLEN
```

ou qualquer estado equivalente.

---

# 8. Fase F — Integração com Device Status Service

## TASK-003-016 — Identificar ponto correto de integração

Encontrar o ponto em que:

```text
heartbeat
    ↓
status
```

é processado.

A integração do WebSocket deve ocorrer nesse fluxo.

Não criar polling paralelo apenas para descobrir mudanças de status.

---

## TASK-003-017 — Detectar mudança real

Implementar lógica para distinguir:

```text
ONLINE → ONLINE
```

de:

```text
ONLINE → OFFLINE
```

Somente uma mudança real deve gerar evento.

---

## TASK-003-018 — Evitar duplicidade

Garantir que múltiplos heartbeats com o mesmo estado não gerem eventos repetidos.

Exemplo:

```text
ONLINE
ONLINE
ONLINE
ONLINE
```

deve produzir:

```text
0 novas transições
```

após o primeiro estado já conhecido.

---

## TASK-003-019 — Emitir evento WebSocket

Quando ocorrer mudança real:

```text
status anterior
      ↓
novo status
      ↓
evento
      ↓
WebSocket Manager
      ↓
Dashboard
```

Garantir que a emissão não quebre o processamento principal caso não existam clientes conectados.

---

# 9. Fase G — Telegram Service

## TASK-003-020 — Verificar dependências existentes

Antes de adicionar biblioteca:

* [ ] verificar dependências já instaladas;
* [ ] verificar se existe cliente HTTP utilizado pelo projeto;
* [ ] reutilizar padrão existente quando possível.

Não adicionar biblioteca Telegram específica sem necessidade.

---

## TASK-003-021 — Criar Telegram Service

Criar serviço isolado para comunicação com Telegram.

Responsabilidades:

* [ ] enviar mensagem;
* [ ] utilizar token configurado;
* [ ] utilizar chat ID configurado;
* [ ] respeitar flag de habilitação;
* [ ] tratar erros.

---

## TASK-003-022 — Não acoplar Telegram ao domínio

O serviço Telegram não deve:

* [ ] calcular status;
* [ ] consultar diretamente o banco;
* [ ] decidir se um dispositivo está offline;
* [ ] conter regra de heartbeat.

Ele deve receber os dados necessários e executar o envio.

---

## TASK-003-023 — Implementar mensagem de alerta

Criar formato de mensagem conforme a SPEC.

A mensagem deve permitir identificar claramente:

* [ ] equipamento;
* [ ] patrimônio, quando disponível;
* [ ] novo status;
* [ ] horário;
* [ ] contexto necessário.

Não inventar informações que não existam no backend.

---

## TASK-003-024 — Implementar alerta de recuperação

Quando previsto pela SPEC:

```text
OFFLINE
   ↓
ONLINE
```

deve gerar mensagem de recuperação.

---

# 10. Fase H — Tratamento de erros do Telegram

## TASK-003-025 — Telegram indisponível

Garantir que:

```text
Telegram DOWN
```

não resulte em:

```text
Heartbeat FAIL
Status FAIL
WebSocket FAIL
```

O processamento principal deve continuar.

---

## TASK-003-026 — Timeout

Implementar timeout adequado para comunicação externa.

Não permitir que uma requisição ao Telegram bloqueie indefinidamente o backend.

---

## TASK-003-027 — Erros de API

Tratar adequadamente:

* [ ] HTTP error;
* [ ] timeout;
* [ ] conexão recusada;
* [ ] token inválido;
* [ ] chat inválido;
* [ ] resposta inesperada.

O comportamento deve seguir o padrão de logging existente.

---

# 11. Fase I — Persistência de alertas

## TASK-003-028 — Verificar necessidade de persistência

Confirmar na SPEC se é necessário persistir alertas.

Se já existir estrutura compatível:

* [ ] reutilizar.

Se não existir:

* [ ] criar model;
* [ ] repository;
* [ ] schema;
* [ ] migration.

---

## TASK-003-029 — Model de alerta

Caso necessário, implementar estrutura capaz de registrar pelo menos:

* [ ] equipamento;
* [ ] evento;
* [ ] status;
* [ ] destino;
* [ ] timestamp;
* [ ] resultado;
* [ ] erro, quando existente.

Respeitar convenções dos models existentes.

---

## TASK-003-030 — Repository de alertas

Implementar acesso ao banco através do padrão existente.

Não fazer:

```text
TelegramService → SQL direto
```

Utilizar:

```text
Service
 ↓
Repository
 ↓
Database
```

---

## TASK-003-031 — Migration

Se houver alteração de banco:

* [ ] criar migration Alembic;
* [ ] verificar migration gerada;
* [ ] verificar dependência da migration anterior;
* [ ] executar `alembic upgrade head`;
* [ ] verificar banco;
* [ ] garantir que migrations anteriores continuam válidas.

---

# 12. Fase J — Orquestração do alerta

## TASK-003-032 — Integrar mudança de status

Implementar fluxo:

```text
Status mudou
      │
      ├──► WebSocket
      │
      └──► Telegram
```

---

## TASK-003-033 — Garantir independência

Falha em:

```text
WebSocket
```

não deve impedir:

```text
Telegram
```

quando tecnicamente aplicável.

Falha em:

```text
Telegram
```

não deve impedir:

```text
WebSocket
```

nem atualização do status.

---

## TASK-003-034 — Evitar duplicidade de alerta

Garantir que:

```text
ONLINE
ONLINE
ONLINE
```

não produza vários alertas.

Uma transição real deve gerar somente os alertas definidos pela SPEC.

---

# 13. Fase K — Dashboard

## TASK-003-035 — Inspecionar Dashboard atual

Antes de alterar:

* [ ] identificar arquitetura;
* [ ] identificar gerenciamento de estado;
* [ ] identificar cliente HTTP;
* [ ] identificar componentes de status;
* [ ] verificar se WebSocket já existe.

---

## TASK-003-036 — Criar cliente WebSocket

Implementar conexão utilizando padrão adequado ao frontend existente.

Responsabilidades:

* [ ] conectar;
* [ ] receber mensagens;
* [ ] processar eventos;
* [ ] atualizar estado;
* [ ] tratar fechamento.

---

## TASK-003-037 — Atualizar status sem reload

Ao receber:

```json
{
  "event": "device_status_changed"
}
```

o Dashboard deve atualizar o dispositivo correspondente.

Não exigir:

```text
F5
```

para refletir mudança.

---

## TASK-003-038 — Reconexão básica

Implementar reconexão quando necessário.

Evitar loop agressivo de reconexão.

Utilizar estratégia simples compatível com MVP.

Não implementar infraestrutura de reconexão distribuída.

---

# 14. Fase L — Integração completa

## TASK-003-039 — Validar fluxo de heartbeat

Confirmar:

```text
Agent
 ↓
Heartbeat
 ↓
FastAPI
 ↓
Device Status Service
```

continua funcionando após as alterações.

---

## TASK-003-040 — Validar mudança para SEM_COMUNICACAO

Simular/produzir condição definida na lógica atual.

Confirmar:

```text
status anterior
        ↓
SEM_COMUNICACAO
        ↓
WebSocket
        ↓
Dashboard
        ↓
Telegram
```

quando aplicável pela SPEC.

---

## TASK-003-041 — Validar mudança para OFFLINE

Confirmar:

```text
SEM_COMUNICACAO
        ↓
OFFLINE
```

gera os comportamentos definidos.

---

## TASK-003-042 — Validar recuperação

Confirmar:

```text
OFFLINE
   ↓
heartbeat
   ↓
ONLINE
```

atualiza:

* [ ] backend;
* [ ] Dashboard;
* [ ] WebSocket;
* [ ] Telegram, se definido pela SPEC.

---

# 15. Fase M — Testes unitários

## TASK-003-043 — Testar WebSocket Manager

Cobrir:

* [ ] conexão;
* [ ] desconexão;
* [ ] broadcast;
* [ ] cliente desconectado;
* [ ] múltiplos clientes.

---

## TASK-003-044 — Testar evento de status

Cobrir:

```text
ONLINE → ONLINE
```

e:

```text
ONLINE → OFFLINE
```

Confirmar comportamento esperado.

---

## TASK-003-045 — Testar Telegram Service

Cobrir:

* [ ] envio bem-sucedido;
* [ ] Telegram desabilitado;
* [ ] timeout;
* [ ] erro HTTP;
* [ ] configuração ausente.

---

## TASK-003-046 — Testar persistência

Caso exista persistência:

* [ ] criação;
* [ ] registro de sucesso;
* [ ] registro de falha;
* [ ] relacionamento com dispositivo;
* [ ] timestamps.

---

# 16. Fase N — Testes de integração

## TASK-003-047 — Testar heartbeat → status

Confirmar que a alteração não quebrou:

```text
heartbeat
 ↓
status
```

---

## TASK-003-048 — Testar status → WebSocket

Confirmar:

```text
mudança de status
 ↓
evento
 ↓
cliente WebSocket
```

---

## TASK-003-049 — Testar status → Telegram

Confirmar:

```text
mudança de status
 ↓
Telegram Service
 ↓
Telegram
```

---

## TASK-003-050 — Testar falha do Telegram

Simular falha.

Confirmar que:

```text
status
```

continua funcionando.

---

## TASK-003-051 — Testar Dashboard

Confirmar:

* [ ] conexão;
* [ ] recebimento;
* [ ] atualização;
* [ ] desconexão;
* [ ] reconexão.

---

# 17. Fase O — Teste de fluxo completo

## TASK-003-052 — Executar cenário completo

Executar cenário:

```text
1. Dispositivo ONLINE
2. Heartbeat recebido
3. Dashboard mostra ONLINE
4. Comunicação interrompida
5. Backend altera estado
6. WebSocket envia evento
7. Dashboard atualiza
8. Telegram recebe alerta
9. Alertas são registrados, quando aplicável
10. Dispositivo volta
11. Heartbeat recebido
12. Estado volta para ONLINE
13. Dashboard atualiza
14. Telegram recebe recuperação, quando aplicável
```

---

# 18. Fase P — Teste de múltiplos dispositivos

## TASK-003-053 — Validar isolamento

Com mais de um dispositivo:

```text
Device A
Device B
Device C
```

uma alteração em A não deve alterar B ou C.

---

## TASK-003-054 — Validar múltiplos clientes WebSocket

Simular:

```text
Dashboard 1
Dashboard 2
```

Ambos devem receber o evento quando conectados.

---

# 19. Fase Q — Segurança

## TASK-003-055 — Verificar secrets

Garantir:

* [ ] token Telegram fora do código;
* [ ] token fora do Git;
* [ ] `.env.example` sem segredo real;
* [ ] logs não exibem token;
* [ ] logs não exibem credenciais.

---

## TASK-003-056 — Revisar exposição do WebSocket

Verificar se o endpoint segue os requisitos de segurança definidos na SPEC.

Não abrir permissões adicionais sem necessidade.

---

# 20. Fase R — Docker

## TASK-003-057 — Validar backend no Docker

Executar o ambiente conforme padrão existente.

Confirmar:

* [ ] backend inicia;
* [ ] banco inicia;
* [ ] migrations funcionam;
* [ ] WebSocket funciona;
* [ ] variáveis são carregadas.

---

## TASK-003-058 — Validar Dashboard no Docker

Confirmar:

* [ ] Dashboard inicia;
* [ ] comunicação com backend funciona;
* [ ] WebSocket funciona no ambiente Docker;
* [ ] nenhuma URL hardcoded incorreta foi introduzida.

---

# 21. Fase S — Testes finais

## TASK-003-059 — Executar suíte de testes

Executar a suíte oficial do backend/frontend conforme estrutura atual.

Registrar:

* testes executados;
* testes aprovados;
* testes falhos;
* motivo de eventual falha.

---

## TASK-003-060 — Corrigir regressões

Se testes existentes quebrarem:

1. identificar causa;
2. corrigir;
3. executar novamente;
4. confirmar que a correção não introduziu outra regressão.

Não ignorar testes quebrados apenas para concluir a fase.

---

# 22. Fase T — Revisão técnica

## TASK-003-061 — Revisar alterações

Executar revisão do diff.

Verificar:

* [ ] arquivos novos;
* [ ] arquivos alterados;
* [ ] migrations;
* [ ] configuração;
* [ ] dependências;
* [ ] testes;
* [ ] Dashboard;
* [ ] backend.

---

## TASK-003-062 — Procurar duplicação

Verificar especificamente se foi criado:

* [ ] segundo status service;
* [ ] segunda regra de status;
* [ ] segundo mecanismo de heartbeat;
* [ ] segundo mecanismo de eventos;
* [ ] acesso direto ao banco fora dos repositories;
* [ ] integração Telegram espalhada pelo código.

Se houver, corrigir.

---

## TASK-003-063 — Revisar complexidade

Remover, quando desnecessário:

* [ ] abstrações prematuras;
* [ ] código morto;
* [ ] dependências não utilizadas;
* [ ] funções duplicadas;
* [ ] infraestrutura não prevista.

A implementação deve permanecer simples para o MVP.

---

# 23. Fase U — Critérios de aceite

A Fase 05 somente será considerada concluída quando:

### WebSocket

* [ ] cliente consegue conectar;
* [ ] cliente consegue desconectar;
* [ ] conexão inválida não derruba backend;
* [ ] broadcast funciona;
* [ ] múltiplos clientes recebem evento.

### Status

* [ ] status continua sendo determinado pelo backend;
* [ ] `device_status_service.py` foi reutilizado;
* [ ] não existem regras duplicadas;
* [ ] eventos somente ocorrem em mudanças reais.

### Dashboard

* [ ] atualização em tempo real funciona;
* [ ] reload não é necessário;
* [ ] reconexão funciona adequadamente.

### Telegram

* [ ] configuração via ambiente;
* [ ] envio funciona;
* [ ] falhas são tratadas;
* [ ] Telegram não interrompe heartbeat;
* [ ] mensagens seguem a SPEC.

### Persistência

* [ ] registros persistidos quando exigidos;
* [ ] migration funcionando;
* [ ] histórico existente preservado.

### Qualidade

* [ ] testes passando;
* [ ] Docker funcionando;
* [ ] nenhum segredo versionado;
* [ ] nenhuma regressão conhecida;
* [ ] diff revisado.

---

# 24. Fase V — Documentação

## TASK-003-064 — Atualizar documentação necessária

Atualizar somente documentação impactada pela implementação.

Possíveis arquivos:

```text
README.md
PROJECT-CONTEXT.md
.env.example
```

Não criar documentação excessiva.

---

## TASK-003-065 — Registrar decisão técnica relevante

Se alguma decisão relevante diferente do planejado tiver sido necessária, verificar se deve ser registrada em:

```text
docs/adr/
```

Não criar ADR para decisões triviais.

---

# 25. Fase W — Preparação do commit

## TASK-003-066 — Verificar Git

Executar:

```bash
git status
```

Verificar cuidadosamente todos os arquivos modificados.

---

## TASK-003-067 — Revisar diff

Executar:

```bash
git diff
```

e, quando necessário:

```bash
git diff --stat
```

Confirmar que somente alterações relacionadas à Fase 05 estão presentes.

---

## TASK-003-068 — Confirmar testes antes do commit

Não realizar commit enquanto houver falha conhecida não justificada.

---

# 26. TASK-003-069 — Commit da Fase 05

Após todos os critérios de aceite:

```bash
git add .
git commit -m "feat(realtime): implement websocket and telegram alerts"
```

O texto final do commit pode ser ajustado ao padrão real do repositório, caso exista convenção diferente.

---

# 27. TASK-003-070 — Push

Após confirmar o commit:

```bash
git push
```

Confirmar que o push foi concluído.

---

# 28. Relatório final obrigatório

Ao terminar, o agente deve apresentar:

## Implementado

Lista objetiva das funcionalidades.

## Arquivos criados

Lista.

## Arquivos alterados

Lista.

## Migrations

Informar se houve migrations.

## Dependências

Informar se alguma dependência foi adicionada.

## Testes

Informar:

```text
Total:
Passaram:
Falharam:
```

ou o formato equivalente produzido pelo framework.

## Validação manual

Informar os cenários executados.

## Problemas encontrados

Listar eventuais problemas.

## Pendências

Somente itens realmente fora do escopo ou que precisam ser tratados posteriormente.

## Commit

Informar:

```text
commit:
hash:
push:
```

---

# 29. Regra final de escopo

Não implementar nesta fase:

```text
Android Management
Android Recovery
Google Management
Segurança Dell
Hardware Tracker
GPS
MDM
Redis
RabbitMQ
Kafka
arquitetura distribuída
```

Esses assuntos pertencem às fases posteriores.

---

# 30. Definição de pronto

A Fase 05 está pronta quando:

```text
HEARTBEAT
    ↓
DEVICE STATUS SERVICE
    ↓
STATUS CHANGE
    ├───────────────┐
    ↓               ↓
WEBSOCKET        TELEGRAM
    ↓               ↓
DASHBOARD        ALERTA
                    ↓
                REGISTRO
```

funciona de ponta a ponta, os testes passam, não existem regressões conhecidas e o código está pronto para o commit da fase.

**Não expandir o escopo após atingir este estado.**
