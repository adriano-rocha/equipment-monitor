# SPEC-007 — Android

## 1. Objetivo

Implementar um aplicativo Android mínimo para integrar smartphones e tablets Android ao `equipment-monitor`, utilizando o mesmo mecanismo de heartbeat já existente no backend.

A Fase 07 deve priorizar uma implementação simples, funcional e confiável, sem criar uma arquitetura paralela ou introduzir funcionalidades que pertencem às fases posteriores.

---

## 2. Contexto

O backend já possui:

* autenticação de dispositivos por `DeviceKey`;
* endpoint `POST /api/v1/heartbeats`;
* registro histórico de heartbeats;
* atualização de `last_seen`;
* cálculo de status de comunicação pelo backend;
* endpoint `GET /api/v1/devices`;
* suporte aos dados de hostname, IP, bateria, metadata e timestamp do dispositivo.

O Android deve atuar como cliente desse contrato existente.

Não será criado um endpoint específico para Android.

---

## 3. Escopo da Fase

### 3.1 Aplicativo Android

Criar um aplicativo Android mínimo capaz de:

* configurar o endereço do backend;
* utilizar uma credencial de dispositivo;
* autenticar-se no backend;
* enviar heartbeats periodicamente;
* coletar informações básicas disponíveis no dispositivo;
* continuar tentando comunicação quando houver falha temporária de rede;
* funcionar em segundo plano dentro das limitações normais do Android.

### 3.2 Comunicação

O aplicativo utilizará:

```text
POST /api/v1/heartbeats
```

Autenticação:

```text
Authorization: DeviceKey <key_id>:<secret>
```

Não será criado novo mecanismo de autenticação.

### 3.3 Payload

O aplicativo poderá utilizar os campos já existentes no contrato:

```json
{
  "hostname": "...",
  "reported_ip": "...",
  "battery_level": 0,
  "metadata": {},
  "device_timestamp": "..."
}
```

Todos os campos continuam opcionais conforme o contrato atual do backend.

O aplicativo não deve enviar campos inexistentes no contrato.

### 3.4 Informações do dispositivo

Quando disponíveis, o aplicativo deverá fornecer:

* identificador/nome adequado para `hostname`;
* endereço IP atualmente utilizado;
* nível de bateria;
* timestamp do dispositivo;
* metadata Android relevante e enxuta.

A metadata deve respeitar o limite de 2048 bytes imposto pelo backend.

---

## 4. Regras de Status

O Android não será responsável pelo cálculo do status de comunicação.

O aplicativo não deve enviar:

```text
ONLINE
SEM COMUNICAÇÃO
OFFLINE
```

O backend continua sendo a única fonte de verdade para o status.

O status continuará sendo derivado de `last_seen` pelo serviço existente.

Assim:

```text
Android envia heartbeat
        ↓
Backend recebe
        ↓
Backend atualiza last_seen
        ↓
Backend calcula status
```

---

## 5. Tratamento de Falha de Comunicação

Quando o Android estiver sem conexão com o backend:

* não deve criar status local;
* não deve tentar alterar `last_seen`;
* não deve informar `OFFLINE` ao backend;
* deve realizar novas tentativas conforme a estratégia definida para o aplicativo.

A ausência de novos heartbeats será interpretada pelo backend através das regras existentes.

Não será implementado store-and-forward ou banco local nesta fase.

---

## 6. Compatibilidade com o Windows Agent

A implementação Android não deve exigir alterações no contrato utilizado pelo Windows Agent.

O endpoint de heartbeat existente deve continuar funcionando para ambos:

```text
Windows Agent ──┐
                ├──> POST /api/v1/heartbeats
Android ────────┘
```

Qualquer alteração no contrato do heartbeat deverá ser considerada mudança de escopo e validada antes da implementação.

---

## 7. Segurança

A autenticação deverá utilizar exclusivamente o mecanismo existente:

```text
DeviceKey <key_id>:<secret>
```

O aplicativo não deve:

* criar credenciais próprias;
* implementar um segundo mecanismo de autenticação;
* armazenar o secret de forma deliberadamente exposta;
* enviar a credencial em campos do JSON;
* criar autenticação específica para Android.

A implementação deverá utilizar armazenamento apropriado do Android para a credencial, dentro do nível de complexidade necessário para o MVP.

---

## 8. Funcionalidades Fora do Escopo

Não fazem parte da Fase 07:

* GPS;
* localização em tempo real;
* Google Find My Device;
* Google Find Hub;
* Android Management/MDM;
* Lost Mode;
* bloqueio remoto;
* apagamento remoto;
* recuperação de dispositivo perdido;
* rastreamento avançado;
* hardware tracker;
* funcionalidades avançadas de segurança;
* gerenciamento corporativo completo do Android.

Esses recursos permanecem reservados para fases posteriores.

---

## 9. Critérios de Aceite

A Fase 07 será considerada funcional quando, utilizando um dispositivo Samsung Android real:

### CA-01 — Configuração

O aplicativo consegue ser configurado com o endereço do backend e a credencial do dispositivo.

### CA-02 — Autenticação

O aplicativo consegue autenticar utilizando:

```text
Authorization: DeviceKey <key_id>:<secret>
```

### CA-03 — Heartbeat

O aplicativo envia periodicamente:

```text
POST /api/v1/heartbeats
```

e recebe:

```text
HTTP 201 Created
```

quando a requisição é válida.

### CA-04 — Atualização do dispositivo

Após os heartbeats, o dispositivo aparece corretamente em:

```text
GET /api/v1/devices
```

### CA-05 — Last Seen

O campo `last_seen` é atualizado pelo backend após o recebimento dos heartbeats.

### CA-06 — Status

O backend calcula corretamente o status do Android utilizando as mesmas regras existentes.

### CA-07 — Perda de comunicação

Quando os heartbeats deixam de ser recebidos, o dispositivo passa pelas transições de status já definidas pelo backend:

```text
ONLINE
   ↓
SEM COMUNICAÇÃO
   ↓
OFFLINE
```

### CA-08 — Windows preservado

O fluxo existente do Windows Agent continua funcionando normalmente após a integração Android.

### CA-09 — Dados

Os dados enviados pelo Android respeitam o contrato atual do heartbeat e o limite de metadata.

---

## 10. Estratégia de Implementação

A implementação seguirá o princípio:

> Fazer funcionar primeiro, testar ao final e corrigir somente o que for necessário.

Ordem sugerida:

1. Criar o projeto Android mínimo.
2. Implementar configuração do backend.
3. Implementar armazenamento seguro da credencial.
4. Implementar cliente HTTP.
5. Implementar heartbeat.
6. Implementar coleta dos dados básicos.
7. Implementar execução periódica.
8. Integrar com o backend existente.
9. Testar no Samsung Android.
10. Corrigir problemas encontrados.
11. Validar critérios de aceite.
12. Commit da fase.

Não serão introduzidas abstrações, bibliotecas ou componentes adicionais sem necessidade comprovada.

---

## 11. Resultado Esperado

Ao final da Fase 07, o `equipment-monitor` deverá conseguir monitorar dispositivos Android utilizando o mesmo fluxo de comunicação já utilizado pelos demais equipamentos.

O Android será apenas mais um tipo de dispositivo monitorado pelo backend, sem criar uma arquitetura paralela.

```text
Windows
   │
   ├──── heartbeat ────┐
   │                   │
Android                ▼
   │              Backend
   └──── heartbeat ────┤
                       │
                       ▼
                  PostgreSQL
                       │
                       ▼
                   Dashboard
```

A Fase 07 deverá entregar somente a capacidade de **monitoramento e comunicação básica do Android**.

Recursos de recuperação, localização, gerenciamento e segurança avançada permanecem para as fases seguintes.
