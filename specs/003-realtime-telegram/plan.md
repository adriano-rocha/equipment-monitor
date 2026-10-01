# PLAN-003 — Realtime + Telegram

## 1. Objetivo

Implementar a Fase 05 do `equipment-monitor`, adicionando:

* atualização de status em tempo real no Dashboard;
* comunicação via WebSocket;
* integração com Telegram para alertas;
* registro das notificações enviadas;
* reaproveitamento da lógica existente de status dos dispositivos;
* integração com a arquitetura atual sem duplicar regras de negócio.

A prioridade desta fase é:

> **fazer funcionar rápido → testar tudo no final → validar → commit → próxima fase.**

Não serão introduzidas abstrações ou componentes desnecessários para o MVP.

---

# 2. Estado atual do projeto

A implementação deve partir do código existente.

Especial atenção para:

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   ├── services/
│   └── ...
```

O serviço existente:

```text
device_status_service.py
```

deve ser considerado a fonte atual da lógica de determinação de status.

Não criar uma segunda implementação paralela de status apenas para atender ao WebSocket ou ao Telegram.

---

# 3. Arquitetura planejada

Fluxo principal:

```text
Windows Agent / Android
        │
        │ heartbeat
        ▼
     FastAPI
        │
        ▼
Device Status Service
        │
        ├──────────────► WebSocket Manager
        │                      │
        │                      ▼
        │                 Dashboard
        │
        └──────────────► Telegram Alert Service
                               │
                               ▼
                             Telegram
```

O backend continua sendo a autoridade sobre o estado dos equipamentos.

O Agent não deve determinar:

```text
OFFLINE
SEM COMUNICAÇÃO
ONLINE
```

O Agent apenas envia seus dados/heartbeat.

---

# 4. Reaproveitamento da implementação existente

## 4.1 Device Status Service

Antes de criar qualquer nova regra, analisar e reutilizar:

```text
device_status_service.py
```

O serviço deverá continuar responsável pela determinação do estado do equipamento.

Caso seja necessário adaptar seu retorno para alimentar o WebSocket ou Telegram, fazer a menor alteração possível.

Não duplicar:

```text
ONLINE
SEM_COMUNICACAO
OFFLINE
```

em múltiplos serviços.

---

# 5. WebSocket

## 5.1 Objetivo

Permitir que o Dashboard receba alterações de estado sem precisar ficar fazendo polling contínuo.

Endpoint planejado:

```text
/ws
```

ou outro endpoint equivalente já definido pela arquitetura existente.

## 5.2 WebSocket Manager

Criar um componente simples para controlar as conexões ativas.

Responsabilidades:

* aceitar conexão;
* manter conexões ativas;
* remover conexões encerradas;
* enviar eventos para os clientes conectados;
* tratar desconexões sem derrubar o backend.

Não implementar, nesta fase:

* Redis;
* broker externo;
* múltiplos servidores WebSocket;
* escalabilidade horizontal;
* filas distribuídas.

O objetivo é atender o MVP atual.

---

# 6. Evento de alteração de status

Quando o estado de um equipamento mudar, o backend deverá produzir um evento para o WebSocket.

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

O formato final deve respeitar os schemas existentes do projeto.

Os estados permitidos continuam sendo somente:

```text
ONLINE
SEM_COMUNICACAO
OFFLINE
```

Não criar o estado:

```text
STOLEN
ROUBADO
```

ou equivalente.

---

# 7. Regra de mudança de estado

O sistema deve evitar eventos e alertas duplicados quando o estado não mudou.

Exemplo:

```text
ONLINE
ONLINE
ONLINE
ONLINE
```

não deve gerar uma nova notificação a cada heartbeat.

Já:

```text
ONLINE
      ↓
SEM_COMUNICACAO
```

representa uma mudança de estado e pode gerar evento.

Da mesma forma:

```text
SEM_COMUNICACAO
      ↓
OFFLINE
```

representa uma nova transição.

O mecanismo deve utilizar o estado anterior já existente no backend sempre que possível.

Não criar um segundo armazenamento de estado sem necessidade.

---

# 8. Telegram

## 8.1 Objetivo

Enviar alertas operacionais para um Telegram configurado no ambiente.

A integração deve ficar isolada em um serviço próprio.

Exemplo conceitual:

```text
telegram_service.py
```

Responsabilidades:

* configurar comunicação com a API do Telegram;
* enviar mensagem;
* tratar erro de comunicação;
* registrar sucesso/falha quando aplicável.

A lógica de negócio não deve conhecer detalhes da API HTTP do Telegram.

---

# 9. Configuração do Telegram

As credenciais nunca devem ficar hardcoded.

Utilizar variáveis de ambiente, por exemplo:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ENABLED=true
```

Os nomes definitivos devem seguir o padrão de configuração já utilizado no projeto.

Atualizar:

```text
.env.example
```

com as variáveis necessárias, mas sem valores reais.

---

# 10. Alertas do Telegram

No MVP, os alertas devem ser associados principalmente às mudanças relevantes de status.

Exemplo:

```text
ONLINE → SEM_COMUNICACAO
```

pode gerar alerta.

```text
SEM_COMUNICACAO → OFFLINE
```

pode gerar outro alerta.

```text
OFFLINE → ONLINE
```

pode gerar recuperação.

A implementação deve seguir exatamente as regras definidas na `spec.md`.

Não adicionar regras de negócio que não estejam previstas na SPEC.

---

# 11. Registro de alertas

Os alertas enviados devem possuir registro persistente quando isso estiver previsto pelo modelo definido na SPEC.

O registro deve permitir identificar, no mínimo:

* equipamento;
* tipo de evento;
* status relacionado;
* data/hora;
* destino;
* resultado do envio;
* erro, quando houver.

A estrutura deve aproveitar os padrões existentes de:

```text
models
repositories
schemas
migrations
```

Não criar acesso direto ao banco dentro do serviço do Telegram.

---

# 12. Separação de responsabilidades

A implementação deverá manter a separação:

```text
API
 ↓
Service / Use Case
 ↓
Repository
 ↓
Database
```

E:

```text
Service
 ↓
WebSocket Manager
```

ou:

```text
Service
 ↓
Telegram Service
```

O serviço de Telegram não deve consultar diretamente o banco.

O WebSocket Manager não deve conter regras de negócio de status.

---

# 13. Tratamento de falhas

Falha no Telegram não pode derrubar o processamento principal do equipamento.

Exemplo:

```text
Heartbeat recebido
        ↓
Status atualizado
        ↓
WebSocket atualizado
        ↓
Telegram
        ↓
ERRO
```

O erro do Telegram deve ser tratado e registrado.

O sistema não deve considerar que o heartbeat falhou simplesmente porque o Telegram está indisponível.

Da mesma forma, uma conexão WebSocket encerrada não deve interromper o processamento dos demais clientes.

---

# 14. Dashboard

O Dashboard deverá consumir o WebSocket existente/criado nesta fase.

Ao receber:

```text
device_status_changed
```

deve atualizar o equipamento correspondente sem exigir reload manual da página.

A implementação deve ser simples e compatível com a estrutura atual do Dashboard.

Não reconstruir a interface.

---

# 15. Fluxo completo esperado

### Equipamento funcionando

```text
Agent
  ↓
Heartbeat
  ↓
FastAPI
  ↓
Device Status Service
  ↓
ONLINE
  ↓
WebSocket
  ↓
Dashboard atualizado
```

### Equipamento perde comunicação

```text
Heartbeat deixa de chegar
        ↓
Backend identifica mudança
        ↓
SEM_COMUNICACAO / OFFLINE
        ↓
WebSocket
        ↓
Dashboard atualizado
        ↓
Telegram
        ↓
Alerta registrado
```

### Equipamento volta

```text
Heartbeat
    ↓
Backend
    ↓
ONLINE
    ↓
WebSocket
    ↓
Dashboard
    ↓
Telegram de recuperação
```

---

# 16. Banco de dados e migrations

Caso a SPEC exija novas tabelas ou campos:

1. criar model;
2. criar migration Alembic;
3. executar migration;
4. validar banco;
5. atualizar repositories/services.

Não alterar tabelas existentes sem necessidade.

Não apagar histórico de heartbeat.

Não remover informações utilizadas pelas fases anteriores.

---

# 17. Ordem de implementação

A implementação deve seguir esta ordem prática:

### Etapa 1 — Configuração

* revisar settings;
* adicionar variáveis Telegram;
* atualizar `.env.example`.

### Etapa 2 — WebSocket

* criar/revisar WebSocket endpoint;
* implementar manager;
* conexão/desconexão;
* broadcast.

### Etapa 3 — Integração com status

* conectar o fluxo existente de status ao WebSocket;
* emitir evento somente quando necessário;
* reaproveitar `device_status_service.py`.

### Etapa 4 — Telegram

* criar Telegram service;
* configurar Bot Token e Chat ID;
* implementar envio;
* tratar erros.

### Etapa 5 — Persistência

* implementar model/repository/migration caso previsto na SPEC;
* registrar alertas.

### Etapa 6 — Dashboard

* conectar WebSocket;
* atualizar status em tempo real;
* tratar reconexão básica.

### Etapa 7 — Integração

Validar o fluxo:

```text
Heartbeat
→ Status
→ WebSocket
→ Dashboard
→ Telegram
→ Registro
```

---

# 18. Critérios de implementação

Durante a implementação:

* não refatorar partes não relacionadas;
* não alterar arquitetura das fases anteriores sem necessidade;
* não duplicar regras;
* não criar abstrações prematuras;
* não adicionar dependências sem necessidade;
* manter compatibilidade com Docker;
* manter `.env.example` atualizado;
* preservar migrations existentes;
* preservar histórico de heartbeat;
* manter autenticação/RBAC existente.

---

# 19. Testes

A estratégia desta fase é implementar primeiro e realizar a validação completa ao final.

Ao final da implementação, executar:

### Backend

```text
pytest
```

ou o comando oficial já utilizado pelo projeto.

### Banco

Validar:

```text
alembic upgrade head
```

e verificar se não existem migrations quebradas.

### WebSocket

Validar:

```text
conexão
desconexão
broadcast
mudança de status
múltiplos clientes
```

### Telegram

Validar:

```text
envio
erro de envio
variáveis ausentes
Telegram desabilitado
```

### Dashboard

Validar:

```text
conexão
recebimento do evento
atualização do status
reconexão
```

### Integração

Executar pelo menos um fluxo completo:

```text
heartbeat
    ↓
mudança de status
    ↓
WebSocket
    ↓
Dashboard
    ↓
Telegram
    ↓
registro
```

---

# 20. Critérios de aceite técnicos

A Fase 05 poderá ser considerada implementada quando:

* [ ] WebSocket funcional;
* [ ] Dashboard recebe alterações sem reload;
* [ ] backend continua sendo autoridade do status;
* [ ] `device_status_service.py` é reaproveitado;
* [ ] eventos não são duplicados sem mudança de estado;
* [ ] Telegram envia alertas conforme SPEC;
* [ ] falha do Telegram não interrompe heartbeat/status;
* [ ] alertas são registrados quando previsto;
* [ ] variáveis sensíveis ficam fora do código;
* [ ] `.env.example` atualizado;
* [ ] migrations funcionando;
* [ ] testes existentes continuam passando;
* [ ] fluxo integrado validado;
* [ ] nenhuma funcionalidade das fases anteriores foi quebrada.

---

# 21. Fora do escopo

Não implementar nesta fase:

* Google Android Management;
* gerenciamento avançado de Android;
* MDM completo;
* rastreamento GPS;
* hardware tracker;
* recuperação de equipamento;
* segurança avançada Dell;
* Redis;
* RabbitMQ;
* Kafka;
* arquitetura distribuída;
* escalabilidade horizontal;
* infraestrutura de produção complexa;
* novas funcionalidades de eventos/responsáveis.

Esses itens pertencem às fases posteriores.

---

# 22. Resultado esperado

Ao terminar esta fase, o MVP deverá ser capaz de:

```text
RECEBER HEARTBEAT
       ↓
DETERMINAR STATUS
       ↓
DETECTAR MUDANÇA
       ↓
ATUALIZAR DASHBOARD EM TEMPO REAL
       ↓
ENVIAR ALERTA TELEGRAM
       ↓
REGISTRAR EVENTO/ALERTA
```

Tudo utilizando a arquitetura já existente e sem duplicar a lógica de negócio.

---

# 23. Próximo documento

Após aprovação deste `plan.md`, criar:

```text
specs/003-realtime-telegram/
└── tasks.md
```

O `tasks.md` deverá transformar este plano em tarefas pequenas e executáveis pelo Claude, mantendo a estratégia:

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
