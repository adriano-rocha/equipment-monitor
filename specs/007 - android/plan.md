# PLAN-007 — Android

## 1. Objetivo

Implementar o cliente Android mínimo definido na SPEC-007, reutilizando integralmente o contrato de heartbeat e autenticação já existente no backend.

A implementação deve priorizar:

* simplicidade;
* funcionamento real;
* baixo número de dependências;
* integração com o backend existente;
* facilidade de teste no Samsung Android.

---

## 2. Estratégia

A implementação será feita em uma única integração vertical:

```text
Android
   ↓
Configuração
   ↓
DeviceKey
   ↓
HTTP Client
   ↓
POST /api/v1/heartbeats
   ↓
Backend existente
   ↓
last_seen
   ↓
/devices
   ↓
Dashboard
```

Não será criado endpoint adicional no backend.

---

## 3. Componentes

### 3.1 Aplicativo Android

Criar a estrutura mínima necessária para:

* iniciar o aplicativo;
* configurar o backend;
* armazenar a configuração;
* realizar autenticação;
* coletar dados básicos;
* enviar heartbeat;
* repetir o envio periodicamente.

### 3.2 Configuração

A configuração mínima deverá contemplar:

* URL do backend;
* `key_id`;
* `secret`.

A configuração deve ser simples para facilitar os testes iniciais.

### 3.3 Autenticação

Utilizar diretamente:

```text
Authorization: DeviceKey <key_id>:<secret>
```

Não implementar nova camada de autenticação.

### 3.4 Cliente HTTP

Implementar somente o necessário para executar:

```text
POST /api/v1/heartbeats
```

O cliente deverá:

* adicionar o header `Authorization`;
* serializar o payload;
* interpretar sucesso;
* tratar falha de conexão;
* permitir nova tentativa no próximo ciclo.

### 3.5 Coleta de dados

Coletar, quando disponíveis:

* hostname/identificador;
* IP atual;
* bateria;
* timestamp;
* metadata Android mínima.

Evitar coleta de informações que não sejam utilizadas pelo backend ou dashboard.

### 3.6 Heartbeat

O heartbeat deverá utilizar o intervalo definido pelo projeto/backend como referência.

O aplicativo não deverá implementar a lógica de:

```text
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

Esses estados continuam sendo calculados exclusivamente pelo backend.

### 3.7 Execução em segundo plano

Implementar o mecanismo Android adequado para manter o heartbeat funcionando em segundo plano, utilizando a solução mais simples compatível com a versão Android de teste.

Não criar um sistema próprio de agendamento ou infraestrutura desnecessária.

---

## 4. Backend

Inicialmente, **não modificar o backend**.

O backend já possui:

```text
POST /api/v1/heartbeats
GET  /api/v1/devices
```

e autenticação:

```text
DeviceKey <key_id>:<secret>
```

Somente realizar alteração no backend se o teste de integração demonstrar uma incompatibilidade real.

---

## 5. Ordem de Implementação

### Etapa 01 — Projeto Android

Criar o projeto Android mínimo e validar:

* compilação;
* instalação;
* execução no Samsung Android.

### Etapa 02 — Configuração

Implementar configuração do:

* backend;
* `key_id`;
* `secret`.

Validar persistência e recuperação da configuração.

### Etapa 03 — Comunicação

Implementar o cliente HTTP e realizar uma chamada manual ao endpoint de heartbeat.

Validar:

```text
HTTP 201 Created
```

### Etapa 04 — Dados

Adicionar:

* bateria;
* IP;
* identificador/hostname;
* timestamp;
* metadata mínima.

### Etapa 05 — Heartbeat periódico

Implementar o envio periódico.

Confirmar no backend que:

```text
last_seen
```

é atualizado continuamente.

### Etapa 06 — Background

Garantir que o heartbeat continue funcionando quando o aplicativo não estiver em primeiro plano, respeitando as limitações do Android.

### Etapa 07 — Integração

Confirmar:

```text
Android
   ↓
heartbeat
   ↓
Backend
   ↓
Device
   ↓
/devices
   ↓
Dashboard
```

### Etapa 08 — Validação

Executar os testes no Samsung Android real.

Validar:

* autenticação;
* heartbeat;
* atualização de `last_seen`;
* dados enviados;
* status `ONLINE`;
* perda de comunicação;
* retorno da comunicação;
* preservação do Windows Agent.

---

## 6. Testes

### Teste 01 — Instalação

O aplicativo instala e inicia normalmente.

### Teste 02 — Credencial válida

Com `key_id` e `secret` válidos:

```text
POST /api/v1/heartbeats
→ 201
```

### Teste 03 — Credencial inválida

Com credencial inválida:

```text
→ autenticação rejeitada
```

O aplicativo não deve interpretar uma credencial inválida como problema de conectividade.

### Teste 04 — Heartbeat

Com o aplicativo funcionando:

```text
last_seen
```

deve ser atualizado.

### Teste 05 — Dashboard

O Android deve aparecer na listagem de dispositivos.

### Teste 06 — Bateria

O nível de bateria enviado deve estar dentro do intervalo:

```text
0–100
```

### Teste 07 — Metadata

A metadata enviada deve permanecer dentro do limite de:

```text
2048 bytes
```

### Teste 08 — Sem Internet

Desconectar o dispositivo da rede.

Confirmar que:

* o aplicativo não quebra;
* novas tentativas ocorrem;
* nenhum status é enviado pelo Android.

### Teste 09 — Retorno da Internet

Restabelecer a conexão.

Confirmar que os heartbeats voltam a ser recebidos.

### Teste 10 — Status Backend

Confirmar a transição:

```text
ONLINE
↓
SEM COMUNICAÇÃO
↓
OFFLINE
```

e posteriormente o retorno para:

```text
ONLINE
```

quando os heartbeats forem restabelecidos.

### Teste 11 — Windows

Confirmar que o Windows Agent continua funcionando normalmente.

---

## 7. Critérios para Correção

Durante os testes:

1. Corrigir primeiro problemas que impedem a execução.
2. Depois corrigir problemas de integração.
3. Depois corrigir problemas de estabilidade.
4. Não refatorar código que já funciona sem necessidade.
5. Não adicionar funcionalidades fora da SPEC.

---

## 8. Fora do Plano

Não implementar durante esta fase:

* GPS;
* localização;
* Find My Device;
* Find Hub;
* MDM;
* Lost Mode;
* bloqueio remoto;
* apagamento remoto;
* hardware tracker;
* recuperação de dispositivo;
* painel Android específico;
* sistema próprio de sincronização offline;
* infraestrutura adicional no backend.

---

## 9. Definition of Done

A Fase 07 estará concluída quando:

* [ ] aplicativo Android compila;
* [ ] aplicativo instala no Samsung Android;
* [ ] configuração funciona;
* [ ] credencial é armazenada adequadamente;
* [ ] autenticação funciona;
* [ ] heartbeat funciona;
* [ ] backend recebe `201`;
* [ ] `last_seen` é atualizado;
* [ ] Android aparece em `/devices`;
* [ ] dados básicos são recebidos;
* [ ] heartbeat funciona em background conforme permitido pelo Android;
* [ ] perda de comunicação foi validada;
* [ ] retorno da comunicação foi validado;
* [ ] status continua sendo calculado pelo backend;
* [ ] Windows Agent continua funcionando;
* [ ] não existem alterações desnecessárias no backend;
* [ ] fase validada no dispositivo Android real.

---

## 10. Resultado

Ao finalizar o plano, o sistema deverá possuir:

```text
                    ┌── Windows Agent
                    │
                    │ heartbeat
                    ▼
               ┌───────────┐
               │  Backend  │
               └───────────┘
                    ▲
                    │ heartbeat
                    │
               Android App
```

Ambos utilizarão o mesmo contrato de heartbeat e serão monitorados pelo mesmo mecanismo de status.

A implementação deve permanecer pequena o suficiente para que a próxima etapa seja testar, corrigir e avançar para a Fase 08.
