# TASKS-007 — Android

## Objetivo

Implementar o cliente Android mínimo definido na SPEC-007 e no PLAN-007, integrando-o ao backend existente através do endpoint de heartbeat.

A implementação deve ser direta, funcional e sem overengineering.

---

## T001 — Criar projeto Android

Criar o projeto Android dentro da pasta:

```text
android/
```

### Requisitos

* projeto compilável;
* estrutura Android convencional;
* configuração mínima necessária;
* compatibilidade com o Samsung Android disponível para testes.

### Validação

Executar o build do projeto e confirmar que não existem erros de compilação.

---

## T002 — Criar configuração do aplicativo

Implementar configuração mínima para:

* URL do backend;
* `key_id`;
* `secret`.

### Requisitos

* configuração simples;
* persistência local;
* não deixar o secret exposto desnecessariamente;
* permitir alteração das configurações durante os testes.

### Validação

Configurar o aplicativo e confirmar que os valores permanecem disponíveis após reiniciar o aplicativo.

---

## T003 — Implementar autenticação DeviceKey

Implementar o header:

```text
Authorization: DeviceKey <key_id>:<secret>
```

### Requisitos

* utilizar exatamente o formato existente no backend;
* não criar outro mecanismo de autenticação;
* não enviar `key_id` ou `secret` dentro do JSON do heartbeat.

### Validação

Executar heartbeat com credencial válida e confirmar resposta:

```text
201 Created
```

Testar também credencial inválida e confirmar rejeição.

---

## T004 — Implementar cliente HTTP

Criar o cliente responsável pela comunicação com:

```text
POST /api/v1/heartbeats
```

### Requisitos

Enviar somente os campos previstos no contrato:

```json
{
  "hostname": "...",
  "reported_ip": "...",
  "battery_level": 0,
  "metadata": {},
  "device_timestamp": "..."
}
```

Todos os campos podem ser `null`/omitidos conforme disponibilidade.

### Validação

Confirmar comunicação real com o backend local.

---

## T005 — Implementar coleta de informações Android

Implementar coleta mínima de:

* identificador/nome apropriado para `hostname`;
* IP atual;
* nível de bateria;
* timestamp;
* metadata Android mínima.

### Requisitos

A metadata deve permanecer abaixo do limite de:

```text
2048 bytes
```

Não coletar informações que não tenham finalidade nesta fase.

### Validação

Enviar heartbeat e verificar os dados recebidos pelo backend.

---

## T006 — Implementar heartbeat periódico

Implementar envio periódico do heartbeat.

### Requisitos

* utilizar o intervalo definido pelo projeto;
* não calcular status de comunicação;
* não enviar `ONLINE`, `SEM COMUNICAÇÃO` ou `OFFLINE`;
* tratar falhas de comunicação sem quebrar o aplicativo.

### Validação

Com o aplicativo em execução, confirmar atualização contínua de:

```text
last_seen
```

---

## T007 — Implementar execução em segundo plano

Implementar o mecanismo Android adequado para manter o heartbeat funcionando quando o aplicativo não estiver em primeiro plano.

### Requisitos

* utilizar mecanismo nativo adequado;
* manter implementação simples;
* respeitar limitações do Android;
* evitar infraestrutura própria de agendamento.

### Validação

Colocar o aplicativo em segundo plano e confirmar recebimento dos heartbeats.

---

## T008 — Tratamento de falha de rede

Implementar tratamento básico para ausência de conexão.

### Requisitos

Quando o backend estiver indisponível:

* aplicativo não deve encerrar;
* erro deve ser tratado;
* próxima tentativa deve ocorrer;
* não deve criar status local;
* não deve alterar `last_seen` localmente.

### Validação

Desconectar o dispositivo da rede e observar o comportamento.

---

## T009 — Integração com o backend

Executar a integração vertical completa:

```text
Android
  ↓
DeviceKey
  ↓
POST /api/v1/heartbeats
  ↓
RegisterHeartbeatUseCase
  ↓
last_seen
  ↓
GET /api/v1/devices
```

### Validação

Confirmar que o dispositivo Android aparece corretamente na listagem de devices.

---

## T010 — Validação do status

Confirmar que o status permanece exclusivamente sob responsabilidade do backend.

### Cenário

Com heartbeat ativo:

```text
ONLINE
```

Interromper os heartbeats:

```text
SEM COMUNICAÇÃO
```

Após ultrapassar o limite:

```text
OFFLINE
```

Restabelecer os heartbeats:

```text
ONLINE
```

### Validação

Confirmar todas as transições através do backend/dashboard.

---

## T011 — Teste de retorno da comunicação

Simular:

```text
ONLINE
↓
sem internet
↓
OFFLINE
↓
internet restaurada
↓
ONLINE
```

### Validação

Confirmar que o aplicativo retoma os heartbeats sem necessidade de reinstalação ou intervenção manual no aplicativo.

---

## T012 — Regressão Windows Agent

Executar heartbeat utilizando o Windows Agent existente após a integração Android.

### Objetivo

Garantir que a Fase 07 não quebrou o fluxo já existente.

### Validação

Confirmar:

* autenticação;
* heartbeat;
* `last_seen`;
* status;
* funcionamento normal do Windows Agent.

---

## T013 — Validação final no Samsung Android

Executar a bateria final de testes utilizando o Samsung Android disponível.

### Validar

* instalação;
* configuração;
* autenticação;
* heartbeat;
* bateria;
* IP;
* metadata;
* timestamp;
* background;
* perda de rede;
* retorno da rede;
* status;
* integração com dashboard.

---

## T014 — Revisão final

Revisar a implementação procurando:

* código desnecessário;
* dependências desnecessárias;
* funcionalidades fora da SPEC;
* logs contendo secrets;
* alterações desnecessárias no backend;
* problemas evidentes de estabilidade.

Remover somente o que for claramente desnecessário.

---

## T015 — Commit da Fase 07

Após todos os testes e validações:

```text
git status
git diff
```

Revisar alterações e criar o commit da fase.

### Commit sugerido

```text
feat(android): implement Android device monitoring
```

---

# Definition of Done

A Fase 07 estará concluída quando:

* [ ] T001 concluída
* [ ] T002 concluída
* [ ] T003 concluída
* [ ] T004 concluída
* [ ] T005 concluída
* [ ] T006 concluída
* [ ] T007 concluída
* [ ] T008 concluída
* [ ] T009 concluída
* [ ] T010 concluída
* [ ] T011 concluída
* [ ] T012 concluída
* [ ] T013 concluída
* [ ] T014 concluída
* [ ] T015 concluída

E, principalmente:

> Um Samsung Android real deverá enviar heartbeats autenticados ao backend existente e ser monitorado pelo mesmo fluxo de status utilizado pelos demais dispositivos.

---

# Regra de Execução

A implementação deve seguir:

```text
IMPLEMENTAR
    ↓
TESTAR
    ↓
CORRIGIR
    ↓
VALIDAR
    ↓
COMMIT
```

Não implementar funcionalidades das Fases 08–10 durante esta fase.
