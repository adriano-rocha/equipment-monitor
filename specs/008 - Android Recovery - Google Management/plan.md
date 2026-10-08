# PLAN-008 — Android Recovery / Google Management

## 1. Objetivo

Validar a estratégia de recuperação dos dispositivos Android e determinar se o Equipment Monitor precisa de novas funcionalidades para suportá-la.

A prioridade é reutilizar os recursos nativos do Android/Samsung/Google e evitar complexidade desnecessária.

## 2. Estado inicial

O projeto já possui:

* Android Agent;
* DeviceKey;
* SecureSecretStore;
* HeartbeatService;
* HeartbeatClient;
* DeviceInfoProvider;
* heartbeat periódico;
* backend FastAPI;
* identificação do dispositivo;
* status de comunicação;
* Dashboard;
* Telegram;
* estado operacional separado.

## 3. Estratégia

A fase foi conduzida em quatro etapas:

```text
1. Revisar arquitetura
        ↓
2. Definir Recovery
        ↓
3. Validar Samsung/Google
        ↓
4. Review e encerramento
```

## 4. Modelo operacional

O fluxo definido é:

```text
ONLINE
   |
   v
SEM COMUNICAÇÃO
   |
   v
OFFLINE
   |
   v
Operador avalia a situação
   |
   +--> problema de comunicação
   |
   +--> necessidade de Recovery
             |
             v
      Samsung Find / Google
```

O backend continua sendo a autoridade para o status de comunicação.

O Android Agent não decide se um equipamento está perdido ou roubado.

## 5. Avaliação do Samsung Find

Foi utilizado um Samsung real para validação.

Resultado:

* Samsung Find disponível;
* aparelho identificado;
* recurso de localização funcional;
* localização apresentada através do Google Maps;
* mecanismo nativo suficiente para o MVP.

Resultado da avaliação:

**Não criar rastreamento próprio no Equipment Monitor.**

## 6. Validação do Heartbeat

O Samsung foi testado com o aplicativo Equipment Monitor.

Resultado:

```text
Heartbeat → Backend → ONLINE
```

A perda de comunicação também foi simulada.

Resultado:

```text
ONLINE
   ↓
sem comunicação
   ↓
OFFLINE
```

O Dashboard refletiu o estado `OFFLINE`.

O Telegram também recebeu o alerta correspondente.

O retorno da comunicação foi validado posteriormente, confirmando o retorno ao estado operacional esperado.

## 7. Implementação

Após a análise e os testes, foi determinado:

**Nenhuma alteração de código é necessária para a Fase 08.**

Não serão adicionados:

* GPS;
* localização;
* coordenadas;
* endpoint de localização;
* banco de localização;
* permissões de localização;
* serviço Android adicional;
* integração direta com Samsung Find.

## 8. Segurança

A estratégia mantém:

* DeviceKey protegida;
* secret armazenado no Android Keystore;
* nenhuma credencial Google no aplicativo;
* nenhuma localização armazenada no backend;
* nenhuma coleta desnecessária de dados pessoais;
* nenhuma função própria de bloqueio ou apagamento.

## 9. Android Enterprise / AMAPI

Android Enterprise e Android Management API foram considerados como possíveis tecnologias futuras.

Não serão implementados nesta fase.

A necessidade deverá ser reavaliada somente caso o produto comercial exija gerenciamento corporativo avançado.

## 10. Resultado esperado

A fase deve terminar com:

* estratégia de Recovery documentada;
* Samsung/Google validados;
* comunicação validada;
* Dashboard validado;
* Telegram validado;
* arquitetura preservada;
* nenhuma complexidade desnecessária adicionada.

## 11. Encerramento

A Fase 08 será considerada concluída quando o `task.md` estiver atualizado, a revisão final estiver registrada e a documentação estiver pronta para commit.

Nenhum código adicional deve ser criado apenas para caracterizar a existência da fase.
