# SPEC-008 — Android Recovery / Google Management

## 1. Objetivo

Definir e validar a estratégia de recuperação de dispositivos Android do Equipment Monitor, utilizando os recursos nativos disponíveis no ecossistema Samsung/Google, sem transformar o projeto em uma solução MDM ou em um sistema próprio de rastreamento.

A fase deve preservar a separação entre:

* comunicação do equipamento;
* estado operacional;
* recuperação do equipamento.

## 2. Princípios

### 2.1 Comunicação não representa recuperação

Os estados de comunicação permanecem:

* `ONLINE`
* `SEM COMUNICAÇÃO`
* `OFFLINE`

`OFFLINE` significa somente ausência de comunicação com o backend dentro do limite configurado.

`OFFLINE` não significa:

* perdido;
* roubado;
* furtado;
* recuperado.

A decisão de iniciar um procedimento de Recovery continua sendo operacional.

### 2.2 Estado operacional separado

O `operational_state` existente continua responsável pelo estado operacional do equipamento.

Não será criado um estado `RECOVERY`, `ROUBADO` ou `PERDIDO` nesta fase.

### 2.3 Recovery utilizando recursos nativos

Quando houver necessidade de recuperação, o operador poderá utilizar os recursos nativos do dispositivo, como Samsung Find/recursos Google disponíveis no aparelho.

O Equipment Monitor não implementará seu próprio sistema de localização.

## 3. Escopo

### Dentro do escopo

* revisar a arquitetura atual;
* definir o modelo operacional de Recovery;
* avaliar Samsung Find / recursos Google;
* validar o funcionamento em um Samsung real;
* definir a relação entre Equipment Monitor e Recovery;
* documentar limitações;
* validar segurança e separação de responsabilidades.

### Fora do escopo

Não implementar nesta fase:

* GPS próprio;
* rastreamento contínuo;
* servidor próprio de localização;
* armazenamento de coordenadas;
* endpoint próprio de localização;
* coleta de localização pelo heartbeat;
* bloqueio remoto próprio;
* apagamento remoto próprio;
* kiosk mode;
* MDM completo;
* Android Enterprise como implementação;
* Android Management API como implementação;
* integração direta com APIs Google/Samsung.

## 4. Arquitetura definida

O Equipment Monitor permanece responsável por:

* patrimônio;
* dispositivo;
* evento;
* responsável;
* heartbeat;
* status de comunicação;
* histórico;
* alertas Telegram.

O mecanismo nativo Samsung/Google permanece responsável pelos recursos de localização e recuperação disponíveis no aparelho.

Fluxo:

```text
Samsung Android
      |
      | Heartbeat
      v
Equipment Monitor
      |
      +--> ONLINE
      +--> SEM COMUNICAÇÃO
      +--> OFFLINE
      |
      v
Operador identifica necessidade de Recovery
      |
      v
Samsung Find / recursos Google
      |
      v
Localização / recuperação
```

## 5. Critérios de aceitação

* [x] Estratégia de Recovery definida.
* [x] Separação entre comunicação e recuperação preservada.
* [x] `OFFLINE` não representa automaticamente perda ou furto.
* [x] Samsung Find avaliado.
* [x] Localização do Samsung validada em aparelho real.
* [x] Heartbeat Android validado.
* [x] Perda de comunicação validada.
* [x] Dashboard validado.
* [x] Telegram validado.
* [x] Retorno da comunicação validado.
* [x] Nenhuma infraestrutura própria de rastreamento criada.
* [x] Nenhuma credencial Google adicionada ao projeto.
* [x] Android Enterprise / AMAPI documentados como evolução futura.

## 6. Resultado da fase

A análise e os testes demonstraram que não é necessário adicionar código de Recovery ao Equipment Monitor para o MVP.

A arquitetura atual já permite detectar a perda de comunicação e alertar o operador, enquanto o Samsung/Google fornece o mecanismo nativo de localização e recuperação.

Portanto, a Fase 08 será encerrada sem alteração funcional no código existente.

## 7. Evoluções futuras

Caso a operação comercial exija gerenciamento corporativo avançado, poderá ser aberta uma fase específica para:

* Android Enterprise;
* Android Management API;
* políticas corporativas;
* gerenciamento remoto;
* integração administrativa;
* estratégias corporativas de contas Google.

Esses recursos não fazem parte do MVP desta fase.
