# SPEC-003 — Realtime + Telegram

## 1. Objetivo

Implementar a camada de comunicação em tempo real do Equipment Monitor, permitindo que alterações relevantes no estado de comunicação dos dispositivos sejam refletidas no Dashboard sem depender exclusivamente de polling e que alertas operacionais sejam enviados ao Telegram.

A implementação deve utilizar o backend FastAPI como fonte central de verdade.

O Windows Agent continua responsável exclusivamente pelo envio de telemetria/heartbeat.

O backend continua responsável por determinar o estado de comunicação dos dispositivos.

---

## 2. Escopo

Esta SPEC contempla:

1. WebSocket autenticado para comunicação entre backend e Dashboard.
2. Gerenciamento básico das conexões WebSocket.
3. Publicação de eventos relevantes para clientes conectados.
4. Detecção de transições do estado de comunicação.
5. Registro de alertas quando aplicável.
6. Integração com Telegram Bot API.
7. Envio de notificações operacionais ao Telegram.
8. Configuração segura das credenciais do Telegram.
9. Tratamento de falhas de envio ao Telegram sem comprometer o processamento principal do backend.
10. Testes unitários, de integração e API para os componentes críticos.

---

## 3. Fora de escopo

Não fazem parte desta SPEC:

* Redis;
* Celery;
* RabbitMQ;
* Kafka;
* filas distribuídas;
* microserviços;
* persistência de fila de mensagens;
* comandos remotos para dispositivos;
* gerenciamento remoto do Windows Agent;
* integração Telegram → dispositivo;
* inventário de hardware;
* Android;
* Google Android Management;
* hardware tracker;
* alteração do contrato do heartbeat da SPEC-001;
* alteração da autenticação DeviceKey;
* sistema completo de preferências de notificações;
* múltiplos canais de notificação;
* processamento de comandos enviados pelo Telegram.

---

## 4. Regras de negócio

### REGRA 01 — Backend como fonte de verdade

O estado de comunicação do dispositivo é determinado pelo backend.

O Dashboard e o Telegram não calculam o estado do dispositivo.

### REGRA 02 — Agent não declara estado

O Windows Agent não envia campos como:

* ONLINE;
* OFFLINE;
* SEM_COMUNICACAO;
* ROUBADO;
* PERDIDO.

O Agent apenas envia telemetria/heartbeat.

### REGRA 03 — Falha de comunicação não significa roubo

A ausência de heartbeat ou mudança para `SEM_COMUNICACAO` jamais deve gerar automaticamente a classificação de dispositivo roubado, perdido ou furtado.

### REGRA 04 — Eventos devem representar mudanças relevantes

O sistema deve evitar geração repetitiva de alertas enquanto o dispositivo permanece no mesmo estado.

Exemplo:

```text
ONLINE
↓
SEM_COMUNICACAO
```

gera uma transição relevante.

A permanência em:

```text
SEM_COMUNICACAO
```

não deve gerar um novo alerta a cada ciclo de verificação.

### REGRA 05 — Histórico de heartbeat

O histórico de heartbeat permanece preservado no PostgreSQL conforme definido na SPEC-001.

A camada Realtime/Telegram não sobrescreve nem remove heartbeats históricos.

### REGRA 06 — WebSocket não substitui persistência

O WebSocket é um canal de entrega em tempo real.

O PostgreSQL continua sendo a fonte persistente dos dados.

Um cliente que estiver desconectado não deve causar perda ou alteração do histórico persistido.

### REGRA 07 — Telegram é canal de notificação

Telegram será utilizado para notificação operacional.

O Telegram não será fonte de verdade sobre o estado dos dispositivos.

### REGRA 08 — Falha do Telegram não pode derrubar o monitoramento

Uma falha de comunicação com a API do Telegram não deve impedir:

* persistência do heartbeat;
* atualização do estado;
* processamento do backend;
* funcionamento do Dashboard.

Falhas de Telegram devem ser tratadas e registradas.

### REGRA 09 — Credenciais fora do código

O token do Telegram Bot deve ser fornecido por variável de ambiente/configuração segura.

Nunca deve ser armazenado diretamente no código-fonte.

### REGRA 10 — Não expor segredos

Tokens, secrets e credenciais não devem aparecer em logs, respostas HTTP ou eventos enviados ao Dashboard.

---

## 5. Estado de comunicação

A implementação deve utilizar o modelo já definido no projeto:

```text
communication_status:
    ONLINE
    SEM_COMUNICACAO
```

A regra exata de cálculo permanece centralizada no backend.

Para o MVP, deve ser utilizada a configuração existente de intervalo/threshold definida pelo projeto, sem criar uma segunda lógica paralela no WebSocket ou Telegram.

---

## 6. WebSocket

Deve existir um endpoint WebSocket versionado para o Dashboard.

Exemplo:

```text
/api/v1/ws
```

A nomenclatura final poderá seguir o padrão já utilizado pelo projeto durante o PLAN.

### Autenticação

Somente clientes autenticados podem receber eventos administrativos do sistema.

A autenticação deve utilizar o mecanismo destinado a usuários humanos, conforme a arquitetura existente.

O DeviceKey utilizado pelos Agents não deve ser reutilizado como mecanismo de autenticação do Dashboard.

### Eventos

Os eventos enviados pelo WebSocket devem possuir estrutura previsível e versionável.

Exemplo conceitual:

```json
{
  "type": "device.communication_status_changed",
  "device_id": "uuid",
  "communication_status": "SEM_COMUNICACAO",
  "occurred_at": "2026-09-30T12:00:00Z"
}
```

O contrato definitivo será definido no PLAN/implementação.

---

## 7. Transição de estado

O backend deve identificar mudanças relevantes no estado de comunicação.

Exemplo:

```text
ONLINE
   ↓
SEM_COMUNICACAO
```

gera um evento.

Quando a comunicação for restabelecida:

```text
SEM_COMUNICACAO
   ↓
ONLINE
```

também gera um evento.

O sistema não deve gerar notificações repetitivas enquanto não houver nova transição relevante.

---

## 8. Alertas

Quando uma transição configurada como relevante ocorrer, o backend poderá registrar um alerta.

O alerta deve possuir, no mínimo, informações suficientes para identificar:

* dispositivo;
* tipo do evento;
* estado anterior, quando aplicável;
* novo estado;
* timestamp.

A estrutura definitiva será definida no PLAN de acordo com o modelo existente.

---

## 9. Telegram

A integração deverá utilizar a Telegram Bot API através do backend.

Configurações sensíveis:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

devem ser fornecidas por ambiente/configuração segura.

Nenhum segredo deve ser enviado ao frontend.

---

## 10. Mensagens Telegram

As mensagens devem ser objetivas e operacionais.

Exemplo:

```text
Equipment Monitor

Dispositivo: NB-001
Patrimônio: 12345
Evento: alteração de comunicação

Novo estado: SEM_COMUNICACAO
Horário: 30/09/2026 12:00
```

A mensagem não deve afirmar que o equipamento foi roubado, furtado ou perdido apenas porque houve ausência de comunicação.

---

## 11. Recuperação da comunicação

Quando um dispositivo voltar a enviar heartbeat e seu estado mudar:

```text
SEM_COMUNICACAO
↓
ONLINE
```

o sistema deve permitir a publicação do evento correspondente e, quando configurado para isso, enviar a notificação de recuperação ao Telegram.

---

## 12. Falha de entrega Telegram

Se o Telegram estiver indisponível:

1. registrar o erro;
2. preservar o funcionamento do monitoramento;
3. não desfazer a alteração de estado;
4. não desfazer o heartbeat;
5. não bloquear o WebSocket.

Não será implementada fila persistente nesta SPEC.

Retry simples poderá ser utilizado conforme definido no PLAN, desde que não introduza dependências desnecessárias.

---

## 13. Conexões WebSocket

O backend deve manter gerenciamento básico das conexões ativas.

Deve ser possível:

* conectar;
* autenticar;
* receber eventos;
* desconectar;
* remover conexões encerradas.

Uma conexão perdida não deve afetar outras conexões.

Não será implementado cluster/multiprocesso distribuído de WebSocket nesta fase.

---

## 14. Segurança

Devem ser respeitados:

* autenticação de usuários;
* autorização conforme arquitetura existente;
* secrets somente em ambiente/configuração segura;
* nenhuma credencial no frontend;
* nenhum token do Telegram exposto no WebSocket;
* nenhuma credencial em logs;
* validação das mensagens/eventos.

---

## 15. Critérios de aceite

### AC-01 — WebSocket

Um usuário autenticado consegue estabelecer conexão WebSocket com o backend.

### AC-02 — Autenticação

Uma conexão não autenticada não recebe os eventos protegidos do sistema.

### AC-03 — Evento de mudança

Uma mudança relevante de estado de comunicação gera evento WebSocket.

### AC-04 — Recuperação

A transição:

```text
SEM_COMUNICACAO → ONLINE
```

gera evento correspondente.

### AC-05 — Sem spam

A permanência no mesmo estado não gera eventos/notificações repetitivas a cada ciclo.

### AC-06 — Telegram

Uma transição configurada como notificável gera mensagem no Telegram.

### AC-07 — Falha Telegram

Uma falha na API do Telegram não impede o processamento do heartbeat nem a atualização do estado do dispositivo.

### AC-08 — Segurança

O token do Telegram não aparece no código, frontend, resposta HTTP ou logs.

### AC-09 — Persistência

O histórico de heartbeat continua preservado independentemente da conexão WebSocket ou Telegram.

### AC-10 — Recuperação Telegram

Uma falha temporária do Telegram não altera o estado persistido do dispositivo.

---

## 16. Testes

Devem ser previstos:

### Unitários

* geração de eventos;
* detecção de transição;
* prevenção de duplicidade;
* formatação da mensagem Telegram;
* tratamento de erro do Telegram;
* gerenciamento de conexões WebSocket.

### Integração

* backend + PostgreSQL;
* alteração de estado;
* persistência de alerta;
* publicação de evento;
* integração com cliente Telegram mockado.

### API

* autenticação WebSocket;
* conexão;
* recebimento de evento;
* comportamento de cliente não autenticado.

### Manual

Após implementação:

1. iniciar backend;
2. iniciar Dashboard;
3. conectar usuário;
4. enviar heartbeat;
5. confirmar estado ONLINE;
6. interromper comunicação;
7. aguardar transição;
8. verificar Dashboard;
9. verificar Telegram;
10. restabelecer comunicação;
11. verificar retorno para ONLINE.

---

## 17. Restrições arquiteturais

A implementação deve respeitar:

* Clean Architecture existente;
* separação Domain/Application/Infrastructure/Interface;
* backend como fonte de verdade;
* PostgreSQL como persistência;
* FastAPI como API;
* WebSocket como canal realtime;
* Telegram como canal externo de notificação.

Não introduzir novas tecnologias de infraestrutura sem necessidade comprovada.

---

## 18. Resultado esperado

Ao final desta SPEC:

```text
Windows Agent
      ↓
Heartbeat
      ↓
FastAPI
      ↓
PostgreSQL
      ↓
Device Status
      ↓
┌───────────────┐
│               │
▼               ▼
WebSocket     Telegram
│               │
▼               ▼
Dashboard    Coordenador
```

O sistema deverá fornecer monitoramento em tempo real suficiente para o MVP, mantendo simplicidade arquitetural e deixando evoluções como filas distribuídas, múltiplos canais, comandos remotos e infraestrutura escalável para fases futuras.
