# PROJECT-CONTEXT.md — Equipment Monitor

> Este arquivo é a fonte de verdade sobre **o que é o produto e qual é o estado atual do projeto**.
>
> Regras permanentes de engenharia ficam em `CLAUDE.md`.
>
> Requisitos específicos de cada funcionalidade ficam em `specs/`.
>
> Decisões arquiteturais relevantes ficam em `docs/adr/`.

---

# 1. O que é este produto

Equipment Monitor é uma plataforma para uma empresa que fornece/aluga equipamentos (notebooks Dell com Windows, smartphones Samsung com Android) para eventos corporativos e grandes eventos, como Expo São Paulo, Expo Transamérica e Anhembi.

Um coordenador acompanha, via dashboard web, quais equipamentos estão comunicando, sem comunicação ou offline, em qual evento estão, quem é o responsável e o histórico de comunicação.

**Regra fundamental:** o sistema nunca afirma que um equipamento foi roubado apenas por falta de comunicação.

O sistema distingue dois eixos independentes:

* `communication_status`: `ONLINE` | `SEM_COMUNICACAO` | `OFFLINE`
* `operational_state`: `ATIVO` | `RECOLHIDO` | `EM_MANUTENCAO` | `DESATIVADO`

`SEM_COMUNICACAO` ou `OFFLINE` não significa automaticamente equipamento roubado.

Perda de comunicação pode ter múltiplas causas, incluindo bateria, rede, desligamento, falha do agente, manutenção ou outras condições operacionais.

A comunicação com o backend é a fonte utilizada para determinar o estado de comunicação. Os agentes não calculam nem determinam o próprio `communication_status`.

---

# 2. Arquitetura de alto nível

```text
React + Vite (Dashboard)
        │
   REST API / WebSocket
        │
     FastAPI
        │
  Services / Use Cases
        │
    Repositories
        │
    PostgreSQL

Windows Agent ──► FastAPI
Android App ────► FastAPI
FastAPI ────────► Telegram
FastAPI ────────► Google / Android Management (capacidades futuras)
```

Infraestrutura utilizada ou prevista conforme o ambiente:

* Docker e Docker Compose para desenvolvimento e execução local;
* PostgreSQL;
* SQLAlchemy;
* Alembic para migrações;
* `uv` para gerenciamento das dependências Python;
* autenticação JWT para usuários;
* autenticação própria para dispositivos;
* HTTPS e WSS em produção;
* Render (FastAPI containerizado e PostgreSQL gerenciado) e Vercel (Dashboard React) em produção homologada com 57 testes automatizados verdes;
* Notificações via Bot Telegram oficial (`🔔 Asaph-track`) com fuso horário de Brasília (UTC-3).

O Windows Agent e o Android App são clientes da API e não substituem a autoridade do backend sobre regras de negócio ou estado de comunicação.

O estado atual da implantação remota deve ser consultado na seção **9.4 — Implantação remota e banco de dados**.

---

# 3. Regras de negócio permanentes

|    Nº | Regra                                                                                                                                     |
| ----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
|    01 | Todo equipamento possui um patrimônio operacional (`asset_number`).                                                                       |
|    02 | O patrimônio não é chave primária do banco.                                                                                               |
|    03 | Cada dispositivo possui um identificador técnico interno (PK própria).                                                                    |
|    04 | Um equipamento pode participar de vários eventos ao longo da vida útil.                                                                   |
|    05 | O relacionamento equipamento↔evento é feito via tabela de associação (`event_devices`), nunca por um `event_id` fixo dentro de `devices`. |
|    06 | Um equipamento pode ter diferentes responsáveis ao longo do tempo.                                                                        |
|    07 | Histórico de comunicação (`heartbeats`) é preservado, nunca sobrescrito.                                                                  |
|    08 | `last_seen` representa a última comunicação conhecida do dispositivo.                                                                     |
|    09 | O backend decide o `communication_status`; o agente nunca decide sozinho que está offline.                                                |
|    10 | O agente nunca se autodeclara offline.                                                                                                    |
|    11 | Offline/sem comunicação não significa roubado.                                                                                            |
|    12 | Alertas e eventos importantes devem ser registrados conforme as funcionalidades implementadas e suas respectivas specs.                   |
| 13–14 | Segredos nunca ficam em código; devem ser fornecidos por configuração ou mecanismo seguro.                                                |
|    15 | Senhas devem utilizar hash seguro, como Argon2.                                                                                           |
|    16 | Toda entrada externa deve ser validada.                                                                                                   |
|    17 | Endpoints protegidos exigem autenticação.                                                                                                 |
|    18 | Ações administrativas exigem autorização por papel/permissão (RBAC), conforme o escopo definido para usuários.                            |

As regras acima não devem ser reinterpretadas por um agente sem justificativa arquitetural e, quando aplicável, atualização da ADR/spec correspondente.

---

# 4. Modelo conceitual

## 4.1 Entidades principais

Entidades principais do domínio:

* `users`
* `devices`
* `events`
* `event_devices`
* `heartbeats`
* `alerts`

Entidades futuras possíveis:

* `employees`
* `event_assignments`
* `device_locations`
* `device_commands`
* `audit_logs`
* `notification_channels`
* `capabilities`

Não adicionar campos ou entidades por antecipação. A necessidade deve ser demonstrada por uma spec.

## 4.2 Device

Modelo real implementado:

```text
device
├── id (UUID, PK)
├── asset_number (VARCHAR 50, UNIQUE)
├── device_type (VARCHAR 30: notebook | tablet | smartphone)
├── manufacturer (VARCHAR 100, opcional)
├── model (VARCHAR 150, opcional)
├── serial_number (VARCHAR 150, opcional)
├── hostname (VARCHAR 255, atualizado via heartbeat)
├── reported_ip (VARCHAR 45, atualizado via heartbeat)
├── battery_level (INTEGER 0-100, atualizado via heartbeat)
└── last_seen (TIMESTAMP WITH TIME ZONE, atualizado via heartbeat)
```

`asset_number` não é chave primária.

`communication_status` não é coluna persistida: é calculado pelo backend via calculate_communication_status(last_seen, settings).

Campos como hostname, reported_ip, battery_level e last_seen pertencem à telemetria de heartbeat e nunca são aceitos no payload de criação/edição.

## 4.3 Device Credential

```text
device_credential
├── id
├── device_id (FK)
├── key_id (único, indexado)
├── secret_hash
├── status (ACTIVE/REVOKED)
├── created_at
├── revoked_at
└── last_used_at
```

A autenticação de dispositivo utiliza o par:

`key_id + secret`

O secret em sua forma original não é armazenado como credencial persistente pelo backend; o backend mantém o hash correspondente.

Formato de autenticação implementado:

`Authorization: DeviceKey <key_id>:<secret>`

Detalhes arquiteturais estão registrados na ADR-006.

## 4.4 Heartbeat

```text
heartbeat
├── id
├── device_id
├── received_at
├── source_ip
├── reported_ip (opcional)
├── battery_level
├── hostname
├── metadata
└── device_timestamp (informativo)
```

`received_at` representa o momento em que o backend recebeu a comunicação.

`source_ip` representa o endereço observado pelo backend.

`reported_ip`, quando utilizado, representa informação fornecida pelo agente e não é tratado como fonte autoritativa.

`device_timestamp` é informativo e não substitui o timestamp de recebimento do servidor.

Detalhes relacionados a IP estão documentados na ADR-008.

## 4.5 Alert

```text
alert
├── id
├── device_id
├── event_id
├── type
├── status
├── message
├── created_at
└── resolved_at
```

## 4.6 User

```text
user
├── id
├── name
├── email
├── password_hash
├── role
├── created_at
└── updated_at
```

A autenticação de usuário utiliza e-mail e senha.

O backend possui serviço de autenticação de usuários com hash e verificação de senha Argon2, emissão de JWT e validação do token.

O Dashboard utiliza o token de acesso nas requisições autenticadas por meio do cabeçalho:

`Authorization: Bearer <token>`

A existência do campo `role` não comprova, isoladamente, que todas as regras de autorização RBAC estejam implementadas. O escopo de autorização deve ser verificado na implementação, nas specs e nos testes correspondentes.

---

# 5. Fases do projeto

| Fase                                      | Objetivo                                                                     | Estado atualizado                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 — Levantamento e Arquitetura           | `PROJECT-CONTEXT`, `CLAUDE.md`, `AGENTS.md`, ADRs iniciais e primeira spec   | **CONCLUÍDA**                                                                                                                                                       |
| 02 — Backend + PostgreSQL                 | FastAPI, SQLAlchemy, Alembic, Clean Architecture e SPEC-001 Device Heartbeat | **CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO (Render). Migrações automáticas aplicadas no boot do container via Alembic (`alembic upgrade head`).**                         |
| 03 — Windows Agent                        | Cliente de monitoramento para Windows                                        | **CONCLUÍDA E HOMOLOGADA EM NOTEBOOK REAL. Executável portátil autônomo (`asaph-agent.exe`) com `--noconsole`, `agent.toml` automático e boot via `shell:startup`.** |
| 04 — Dashboard                            | React/Vite, consumo da API, listagem, status, busca, filtros e WebSocket     | **CONCLUÍDA E HOMOLOGADA EM PRODUÇÃO (Vercel). Modularizado em componentes limpos, com WebSocket em tempo real, paginação, filtros e banner de bateria crítica.**     |
| 05 — Realtime + Telegram                  | WebSocket, detecção de mudança de status e alertas Telegram                  | **CONCLUÍDA E HOMOLOGADA. WebSocket nativo e bot Telegram (`🔔 Asaph-track`) com horário de Brasília (UTC-3) disparando notificações em tempo real.**             |
| 06 — Eventos + Responsáveis               | CRUD de eventos e associação equipamento↔evento↔posto↔responsável            | **CONCLUÍDA E HOMOLOGADA. Gestão completa de eventos, postos físicos (`location_point`), movimentação e substituição operacional (Swap) com histórico de auditoria.**|
| 07 — Android                              | App Kotlin utilizando a mesma plataforma/backend                             | **CONCLUÍDA E HOMOLOGADA EM SAMSUNG REAL. App Kotlin nativo com scanner de QR Code (ML Kit), Foreground Service e parada protegida por PIN do coordenador (`2026`).**|
| 08 — Android Recovery / Google Management | Validação de recursos de recuperação/gestão Google                           | **Validação básica de localização via Google/Maps realizada. Recursos corporativos avançados documentados para expansão futura.**                                   |
| 09 — Segurança Dell                       | BIOS/TPM/BitLocker/Secure Boot e matriz de compatibilidade                   | **Documentação/revisão registrada. Validação física específica em hardware Dell permanece para a fase corporativa pós-MVP por falta de equipamento disponível.**   |
| 10 — Hardware Tracker Nível 3             | Rastreamento e recursos avançados de hardware                                | **BLOQUEADA até apresentação da proposta e aprovação explícita do cliente.**                                                                                        |

As fases 01 a 07 estão formalmente concluídas, testadas e homologadas em produção com dispositivos físicos.

**Prioridade atual:** Apresentação e demonstração oficial do MVP homologado ao cliente e à banca técnica.

A Fase 10 não deve ser iniciada antes da apresentação da proposta e da aprovação explícita do cliente. Não iniciar uma Fase 11 sem autorização expressa.

---

# 6. Estado das especificações

As especificações conhecidas no repositório são:

```text
specs/
├── 001-device-heartbeat/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
├── 002-windows-agent/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
├── 003-realtime-telegram/
│   ├── spec.md
│   ├── plan.md
│   └── task.md
├── 006 - events-responsibles/
│   ├── spec.md
│   ├── plan.md
│   └── task.md
├── 007 - android/
│   ├── spec.md
│   ├── plan.md
│   └── task.md
├── 008 - Android Recovery - Google Management/
│   ├── spec.md
│   ├── plan.md
│   └── task.md
└── 009 - Segurança Dell/
    ├── spec.md
    ├── plan.md
    └── task.md
```

Essa listagem representa a estrutura registrada para o projeto. Antes de criar ou numerar novas specs, verificar a estrutura real do repositório.

## 6.1 SPEC-001 — Device Heartbeat

**Status: CONCLUÍDA E IMPLEMENTADA.**

Artefatos: `specs/001-device-heartbeat/`.

A SPEC-001 define o contrato de heartbeat consumido pelos clientes de dispositivo.

A implementação contempla autenticação de dispositivo, validação de payload, persistência do heartbeat e atualização de dados de comunicação.

## 6.2 SPEC-002 — Windows Agent

**Status: CONCLUÍDA E HOMOLOGADA.**

Artefatos: `specs/002-windows-agent/`.

A SPEC-002 define o comportamento do cliente Windows responsável por enviar telemetria/heartbeat ao backend.

A implementação foi validada em ambiente de desenvolvimento e homologada em produção em notebook físico real (`DESKTOP-QLG7TSJ`), operando como executável portátil compilado (`asaph-agent.exe`) com `--noconsole` (modo silencioso em segundo plano), detecção automática de `agent.toml` no diretório do binário e log em `agent.log`.

## 6.3 SPEC-003 — Realtime + Telegram

**Status: CONCLUÍDA E HOMOLOGADA.**

Artefatos: `specs/003-realtime-telegram/`.

Implementação completa com canal WebSocket bidirecional ativo entre Render e Vercel e serviço de notificações do Telegram disparando transições de estado (`ONLINE`, `SEM COMUNICAÇÃO`, `OFFLINE`) com cabeçalho oficial `🔔 Asaph-track` e formatação de fuso horário de Brasília (UTC-3).

## 6.4 SPEC-006 — Eventos + Responsáveis

**Status: CONCLUÍDA E HOMOLOGADA.**

Artefatos: `specs/006 - events-responsibles/`.

Implementação completa contemplando criação de eventos, vínculo de equipamentos a postos físicos (`location_point`), atribuição de responsáveis operacionais, movimentação entre postos e fluxo de substituição operacional de emergência (Swap no ponto) preservando integralmente o histórico de auditoria.

## 6.5 SPEC-007 — Android

**Status: CONCLUÍDA E HOMOLOGADA.**

Artefatos: `specs/007 - android/`.

O agente Android nativo em Kotlin foi homologado em celular Samsung físico real. Contempla:
* Leitura de credenciais via câmera por QR Code (Google ML Kit);
* Transmissão contínua em segundo plano via Foreground Service;
* Notificação persistente no sistema operacional;
* Botão "Parar Monitoramento" protegido por diálogo nativo exigindo PIN de 4 dígitos do coordenador (`2026`) para inibir desligamentos acidentais ou indevidos em campo;
* Retomada automática após perda e restabelecimento de sinal.

## 6.6 SPEC-008 — Android Recovery / Google Management

Artefatos: `specs/008 - Android Recovery - Google Management/`.

A validação básica de localização por meio dos recursos Google/Maps foi reportada como realizada.

Não assumir que funcionalidades corporativas avançadas, Android Management API, Lost Mode ou gestão remota foram implementadas apenas porque estão mencionadas no planejamento.

## 6.7 SPEC-009 — Segurança Dell

Artefatos: `specs/009 - Segurança Dell/`.

A documentação da revisão de segurança Dell foi registrada. A validação física específica em hardware Dell permanece pendente enquanto não houver equipamento disponível para os testes necessários.

O teste do agente Windows em ASUS comprova um cenário de compatibilidade com hardware Windows não Dell, mas não substitui os testes específicos de BIOS, TPM, BitLocker ou Secure Boot de um Dell.

## 6.8 Autenticação de usuários

A autenticação de usuários foi adicionada posteriormente ao planejamento original do Dashboard.

Os artefatos de código conhecidos incluem:

* `backend/app/infrastructure/auth/user_auth_service.py`
* `backend/app/interface/deps.py`
* `backend/app/interface/api/v1/auth.py`
* `backend/tests/api/test_auth_api.py`
* `dashboard/src/services/api.js`
* `dashboard/src/Login.jsx`
* `dashboard/src/App.jsx`

Também existe a migração:

`backend/alembic/versions/0be30206e712_adiciona_hash_de_senha_aos_usuarios.py`

A autenticação implementada utiliza Argon2 para verificação de senha e JWT para autenticação de usuário.

**Pendência documental:** revisar e atualizar as specs, plans, tasks e documentação pertinentes para registrar o fluxo real de login/logout, a proteção dos endpoints, a emissão e validação do JWT, a migração de banco e os critérios de aceitação.

Antes de criar uma spec nova, verificar se existe outra especificação ou documentação atual que deva ser estendida. Não criar especificações duplicadas.

---

# 7. Regras específicas da Fase 03 — Windows Agent

As regras completas da Fase 03 estão em:

* `specs/002-windows-agent/spec.md`
* `specs/002-windows-agent/plan.md`
* `specs/002-windows-agent/tasks.md`

As regras abaixo são os invariantes mais importantes para a continuidade entre agentes.

## 7.1 Papel do Agent

O Windows Agent é um cliente de comunicação/telemetria.

Ele:

* coleta os dados previstos pela SPEC-002;
* tenta comunicar com o backend;
* envia heartbeats conforme o contrato da SPEC-001;
* trata falhas de comunicação de acordo com a spec;
* mantém sua execução de forma controlada conforme definido pela Fase 03.

O Agent não é responsável por determinar o estado de comunicação do dispositivo.

## 7.2 Status de comunicação

O Agent:

* não calcula `communication_status`;
* não envia `communication_status`;
* não determina `ONLINE`;
* não determina `SEM_COMUNICACAO`;
* não determina `OFFLINE`;
* não altera o estado do dispositivo no backend.

O backend permanece como fonte de verdade para o estado de comunicação.

Falha na tentativa de comunicação pelo Agent representa uma falha de comunicação, não uma declaração de estado de negócio.

## 7.3 Histórico

O Agent não mantém histórico persistente de heartbeats.

A persistência e o histórico dos heartbeats pertencem ao backend.

Não implementar SQLite, fila local, store-and-forward ou mecanismo equivalente de persistência de telemetria sem nova spec aprovada.

## 7.4 Asset Number

`asset_number` não faz parte da responsabilidade de identificação/autenticação técnica do Agent nesta implementação.

Não utilizar patrimônio como chave primária ou mecanismo de autenticação do dispositivo.

## 7.5 Credencial do dispositivo

A autenticação do Agent utiliza o contrato definido na SPEC-001.

O secret:

* não deve ser hardcoded;
* não deve aparecer em logs;
* não deve aparecer em argumentos de linha de comando;
* não deve aparecer em URLs;
* não deve ser exposto em mensagens de erro;
* não deve ser transformado pelo Agent em hash para autenticação;
* não deve ser validado criptograficamente pelo Agent.

O Agent utiliza a credencial conforme o contrato existente do backend.

## 7.6 Escopo

A Fase 03 não deve antecipar funcionalidades de fases posteriores.

Não implementar nesta fase, sem especificação própria:

* dashboard;
* gerenciamento de eventos;
* responsáveis;
* Android Management;
* rastreamento físico;
* inventário avançado de hardware;
* mecanismos de recuperação;
* funcionalidades avançadas de segurança Dell.

---

# 8. Decisões e ambiguidades

## ADR-003 — Atomicidade do Heartbeat

Heartbeat e atualização de `last_seen` ocorrem na mesma transação.

Uma falha deve resultar em rollback da operação.

## ADR-006 — Identidade e autenticação de dispositivo

Existe separação entre:

* identidade interna do dispositivo (`id`);
* identificador público da credencial (`key_id`);
* segredo da credencial (`secret`).

O patrimônio não é identidade técnica.

O segredo não é chave primária.

## ADR-007 — Comunicação vs. estado operacional

`communication_status` e `operational_state` representam conceitos diferentes.

`communication_status`:

* `ONLINE`
* `SEM_COMUNICACAO`
* `OFFLINE`

`operational_state`:

* `ATIVO`
* `RECOLHIDO`
* `EM_MANUTENCAO`
* `DESATIVADO`

Eles não devem ser fundidos em um único campo genérico `status`.

## ADR-008 — IP observado vs. IP informado

`source_ip` representa o endereço observado pelo backend.

`reported_ip` representa informação enviada pelo dispositivo e não é considerada autoritativa.

Até que exista infraestrutura de proxy reverso confiável definida, o backend utiliza `request.client.host`.

`X-Forwarded-For` não é considerado nesta implementação atual.

As decisões arquiteturais devem continuar registradas nas ADRs pertinentes. Não alterar silenciosamente contratos existentes.

---

# 9. Pendências de negócio e arquitetura

## 9.1 Responsável pelo equipamento

A REGRA 06 estabelece que um equipamento pode ter diferentes responsáveis ao longo do tempo.

Ainda é necessário seguir a spec de Eventos + Responsáveis para definir e manter a representação correta do responsável:

* um `user` do sistema; ou
* um `employee` cadastrado sem acesso ao sistema.

Essa decisão não deve ser tomada arbitrariamente fora da spec correspondente.

## 9.2 Intervalo e threshold de heartbeat

O intervalo registrado na configuração local anteriormente verificada era:

`HEARTBEAT_INTERVAL_SECONDS=30`

A configuração local também indicava:

`OFFLINE_THRESHOLD_SECONDS=90`

Esses valores devem ser confirmados na configuração efetiva do ambiente antes de qualquer alteração.

Não confundir o threshold de comunicação do backend com o intervalo de polling do Dashboard. São configurações distintas.

O `communication_status` deve continuar sendo calculado pelo backend a partir de `last_seen` e das regras/configurações vigentes.

Granularidade por dispositivo ou evento somente deve ser implementada se houver necessidade comprovada.

## 9.3 Proxy reverso / X-Forwarded-For

O tratamento de `X-Forwarded-For` permanece dependente da infraestrutura de produção.

Até que exista uma cadeia de proxy confiável definida, não alterar o comportamento atual de `source_ip`.

## 9.4 Implantação remota e banco de dados (Resolvido e Homologado)

A pendência estrutural anterior foi 100% resolvida:
* O backend está ativo no Render com banco PostgreSQL gerenciado.
* Migrações automáticas do Alembic são executadas no boot do container (`alembic upgrade head`).
* Autenticação via JWT (`/api/v1/auth/login`) e proteção dos endpoints com Bearer Token validadas.
* Total de **57 testes automatizados** executados e passando com **100% de sucesso (verde)** em 29/10/2026.

## 9.5 Autenticação de usuários

A autenticação de usuários foi implementada no backend e integrada ao Dashboard.

Ainda é necessário finalizar a revisão documental e comprovar os critérios relevantes para o MVP:

* login com e-mail e senha;
* verificação segura de senha;
* emissão e validação do JWT;
* expiração do token;
* proteção dos endpoints que exigem autenticação;
* tratamento de token ausente ou inválido;
* comportamento de sessão expirada no Dashboard;
* logout;
* autorização por papel, quando exigida;
* migração de banco para `password_hash`.

A implementação e os testes existentes devem ser a referência. Não reescrever arquivos de autenticação sem identificar uma falha concreta.

O logout do Dashboard limpa o token armazenado no cliente. Não afirmar que o token é revogado no servidor sem implementação específica que comprove isso.

---

# 10. Fase 02 — Encerramento

A SPEC-001 (Device Heartbeat) foi implementada e teve seus critérios de aceitação comprovados por testes automatizados no ambiente de desenvolvimento.

## Estrutura

Backend Python/FastAPI utilizando `uv` e Clean Architecture pragmática:

```text
domain
    ↓
application
    ↓
infrastructure
    ↓
interface / API
```

## Infraestrutura

* Docker Compose;
* PostgreSQL;
* Alembic;
* migrações para as estruturas necessárias ao Device Heartbeat.

## Domínio

Entidades implementadas na base do heartbeat:

* `Device`
* `Heartbeat`
* `DeviceCredential`

As entidades de domínio não dependem diretamente do framework web.

## Persistência

Repositórios SQLAlchemy implementam os ports definidos pela camada de aplicação.

A atomicidade do heartbeat foi definida para que:

* heartbeat;
* atualização de `last_seen`;
* atualização de `last_used_at`;

ocorram dentro da mesma transação.

## Autenticação de dispositivo

Implementada através de:

`Authorization: DeviceKey <key_id>:<secret>`

O backend utiliza Argon2 para armazenamento seguro do segredo.

## API

Endpoint implementado:

`POST /api/v1/heartbeats`

Com:

* autenticação de dispositivo;
* validação de payload;
* `battery_level` entre 0 e 100;
* `metadata` limitada conforme contrato;
* mapeamento de erros HTTP.

Endpoint adicional para consumo do Dashboard:

`GET /api/v1/devices`

Esse endpoint retorna os dispositivos e o `communication_status` calculado pelo backend.

## Testes

O registro histórico da conclusão da Fase 02 indicava 33 testes automatizados, incluindo:

* testes unitários;
* testes de integração com PostgreSQL real;
* testes de API através de TestClient.

Esse número é um registro histórico, não necessariamente o total atual da suíte. A contagem e os resultados atuais devem ser confirmados por execução dos testes.

Os testes de integração/API não devem substituir o banco real por mocks quando o critério exige validação real de persistência.

## Seed

Existe um script manual para criação de dispositivo/credencial de teste:

`backend/scripts/seed_device.py`

---

# 11. Fase 03 — Windows Agent: estado concluído

A Fase 03 foi implementada e validada em ambiente de desenvolvimento.

Artefatos:

* `specs/002-windows-agent/spec.md`
* `specs/002-windows-agent/plan.md`
* `specs/002-windows-agent/tasks.md`

Comando utilizado anteriormente:

```powershell
python .\agent_pilot.py
```

Exemplo de execução validada anteriormente:

```text
Agent iniciado; destino=http://localhost:8000 intervalo=30s
Heartbeat aceito (HTTP 201)
```

O Agent envia heartbeat aproximadamente a cada 30 segundos, conforme a configuração registrada.

O Agent não calcula nem envia `communication_status`.

O backend continua sendo a autoridade para determinar:

* `ONLINE`
* `SEM_COMUNICACAO`
* `OFFLINE`

## Validação em hardware não Dell e Homologação Final

Foi realizado piloto com notebook ASUS e posterior homologação em produção em notebook físico real:

* máquina física: `DESKTOP-QLG7TSJ`;
* IP reportado: `192.168.15.60`;
* bateria real capturada e atualizada: 39% a 59% (em carregamento);
* estado observado no Dashboard: `ONLINE` (verde);
* execução: 100% silenciosa em segundo plano (sem janelas de CMD visíveis com `--noconsole`), gravando logs em `agent.log` e suportando inicialização automática com o Windows via `shell:startup`.

Esse teste comprova o funcionamento do agente portátil autônomo em ambiente Windows de produção.

Ele não substitui a revisão específica de segurança Dell (Fase 09), que permanece documentada para hardware específico.

A Fase 03 não introduziu SQLite, fila local ou store-and-forward.

---

# 12. Fase 04 — Dashboard: estado atualizado

A Fase 04 foi implementada como MVP funcional e recebeu incrementos posteriores de interface e autenticação.

O Dashboard utiliza:

```text
React + Vite
      ↓
    Axios
      ↓
FastAPI REST API
```

## 12.1 Funcionalidades implementadas

O Dashboard possui implementação para:

* listagem de equipamentos;
* patrimônio;
* hostname;
* IP;
* bateria;
* último contato;
* status de comunicação;
* cards de resumo;
* busca por patrimônio;
* busca por hostname;
* busca por IP;
* filtros por status;
* atualização automática dos dados;
* tratamento de carregamento;
* tratamento de erro;
* layout responsivo básico;
* tema escuro com destaque verde;
* atualização de logos;
* favicon;
* ajustes de layout do cabeçalho;
* paginação dos equipamentos;
* tela de login com e-mail e senha;
* botão para mostrar e ocultar a senha;
* armazenamento do token de sessão no `sessionStorage`;
* envio do token Bearer nas requisições autenticadas;
* tratamento de sessão expirada;
* logout no Dashboard.

A implementação dessas funcionalidades não significa que a implantação remota esteja validada.

## 12.2 Status

O Dashboard exibe os estados de comunicação retornados pelo backend:

* `ONLINE`;
* `SEM COMUNICAÇÃO`;
* `OFFLINE`.

O backend também pode retornar `SEM REGISTRO` quando o dispositivo ainda não possui `last_seen`, conforme o contrato implementado.

O Dashboard não calcula o status.

A responsabilidade permanece exclusivamente no backend.

## 12.3 Polling

O Dashboard consulta a API e atualiza os dados automaticamente.

O intervalo de polling deve ser confirmado no código/configuração atual antes de ser registrado como valor definitivo. O intervalo de heartbeat de 30 segundos não prova, por si só, que o polling do Dashboard utilize o mesmo intervalo.

O polling permite que mudanças no estado de comunicação sejam refletidas na interface sem refresh manual.

## 12.4 Busca, filtros e paginação

A busca permite procurar equipamentos pelos campos suportados pela implementação atual, incluindo patrimônio, hostname e IP.

Os filtros disponíveis contemplam os estados de comunicação implementados na interface.

A paginação foi adicionada em um incremento posterior do Dashboard. O comportamento e o tamanho da página devem seguir o código atual.

A busca, a filtragem e a paginação são responsabilidades de apresentação e não alteram as regras de estado de comunicação do backend.

## 12.5 Autenticação de usuários

A autenticação de usuários foi adicionada depois da implementação inicial do Dashboard.

### Backend

O serviço de autenticação está em:

`backend/app/infrastructure/auth/user_auth_service.py`

A implementação utiliza:

* Argon2 para hash e verificação de senha;
* JWT para autenticação de usuário;
* expiração de token configurada;
* validação do token;
* identificação do usuário pelo identificador presente no token.

O endpoint de login está em:

`backend/app/interface/api/v1/auth.py`

Endpoint:

`POST /api/v1/auth/login`

O login recebe e-mail e senha, valida as credenciais e retorna um token de acesso e os dados do usuário. Para credenciais inválidas, o endpoint retorna erro de autenticação sem distinguir publicamente se o e-mail ou a senha está incorreto.

A dependência de autenticação de usuário está em:

`backend/app/interface/deps.py`

A dependência valida o JWT e carrega o usuário correspondente. Tokens inválidos ou usuários inexistentes resultam em rejeição da autenticação.

### Dashboard

A integração com a API está em:

`dashboard/src/services/api.js`

A tela de login está em:

`dashboard/src/Login.jsx`

O controle da sessão está integrado em:

`dashboard/src/App.jsx`

O Dashboard:

* envia e-mail e senha ao endpoint de login;
* recebe o token de acesso;
* armazena o token em `sessionStorage`;
* envia o token nas chamadas autenticadas;
* limpa a sessão local quando o usuário realiza logout;
* trata respostas HTTP 401 como sessão inválida/expirada, exceto na chamada de login.

O botão para mostrar/ocultar a senha é um recurso de usabilidade. Ele não altera o fluxo de autenticação.

### Testes existentes

Os testes de autenticação estão em:

`backend/tests/api/test_auth_api.py`

Os testes apresentados incluem cenários para:

* login válido;
* login com credenciais inválidas;
* token ausente em endpoints protegidos;
* token inválido;
* acesso autenticado a endpoint coberto pelos testes.

A existência desses testes deve ser preservada e sua execução atual deve ser confirmada antes da conclusão do MVP.

### Migração do banco

Foi criada uma migração para adicionar `password_hash` à tabela de usuários:

`backend/alembic/versions/0be30206e712_adiciona_hash_de_senha_aos_usuarios.py`

A migração e suas dependências devem ser verificadas no banco utilizado pelo ambiente de implantação.

### Limites da validação

Não declarar RBAC completo apenas porque existe um campo `role` no modelo.

Não afirmar que o logout revoga o JWT no servidor quando o comportamento implementado é a limpeza do token no cliente.

A revisão final deve verificar a proteção de todos os endpoints relevantes, a expiração do token, o comportamento de sessão e os critérios de autorização definidos para o MVP.

## 12.6 Validação do Dashboard e da autenticação

O Dashboard foi integrado à API e recebeu os incrementos registrados acima.

O fluxo completo hospedado na Vercel está 100% integrado ao backend do Render em produção, com migrações aplicadas no PostgreSQL, comunicação em tempo real via WebSocket ativa e homologado com dispositivos físicos (Windows e Android).

---

# 13. Estado atual da implementação

## Backend

Implementado no repositório:

* FastAPI;
* SQLAlchemy;
* PostgreSQL;
* Alembic;
* Clean Architecture pragmática;
* autenticação de dispositivo;
* heartbeat;
* persistência;
* validações;
* endpoint `POST /api/v1/heartbeats`;
* endpoint `GET /api/v1/devices`;
* cálculo backend de `communication_status`;
* serviço de autenticação de usuário;
* hash e verificação de senha Argon2;
* emissão e validação de JWT;
* endpoint `POST /api/v1/auth/login`;
* dependência de autenticação Bearer;
* testes de API de autenticação de usuário.

**Pendência de implantação:** o backend hospedado apresentou o erro `relation "devices" does not exist`. A implantação remota não deve ser declarada concluída até a verificação do banco, das migrações e dos endpoints.

## Windows Agent

Implementado e validado em ambiente de desenvolvimento:

* execução controlada;
* coleta de dados;
* heartbeat;
* autenticação;
* comunicação com backend;
* intervalo configurado de aproximadamente 30 segundos;
* tratamento de falhas de comunicação.

O piloto ASUS foi reportado como funcional. A revisão de segurança específica em hardware Dell permanece pendente.

## Android Agent

O Android Agent foi implementado e testado em um Samsung real.

Foram reportados:

* heartbeat contínuo por aproximadamente dois minutos;
* desconexão controlada;
* alteração do estado de comunicação após a desconexão;
* retorno à comunicação quando o agente voltou a comunicar.

Registro de teste conhecido em 14/10/2026:

| Campo            | Valor               |
| ---------------- | ------------------- |
| Patrimônio       | `ANDROID-TESTE-001` |
| Hostname         | `android-4171a697`  |
| IP               | `192.168.15.155`    |
| Bateria          | 51%                 |
| Estado reportado | `ONLINE`            |

Esses resultados são registros dos testes reportados. Novas afirmações de validação devem se basear nos resultados efetivamente observados.

## Dashboard

Implementado:

* React;
* Vite;
* Axios;
* listagem de equipamentos;
* status;
* cards;
* busca;
* filtros;
* atualização automática;
* paginação;
* tema escuro com destaque verde;
* atualização de logos, favicon e cabeçalho;
* login;
* controle de exibição da senha;
* integração com JWT;
* tratamento de sessão expirada;
* logout no cliente.

A validação final do MVP precisa incluir o fluxo hospedado após a resolução da pendência do banco.

## Realtime, Telegram e Eventos

Existem especificações para Realtime + Telegram e Eventos + Responsáveis.

A conclusão formal dessas funcionalidades deve seguir os critérios de aceitação, os testes e a implementação real presentes no repositório.

Não declarar uma integração end-to-end validada sem evidência dos cenários relevantes.

## Android Recovery / Google Management

Foi reportada uma validação básica de localização por meio dos recursos Google/Maps.

Isso não comprova a implementação de todas as funcionalidades corporativas avançadas de Android Management, Lost Mode ou gerenciamento remoto.

## Segurança Dell

A documentação da revisão Dell foi registrada.

A validação física em hardware Dell permanece pendente até que o equipamento esteja disponível.

---

# 14. Funcionalidades do MVP em Execução

Fatiamento vertical priorizado:
1. [CONCLUÍDO] SPEC-010: Especificação do CRUD de Equipamentos e Credencial.
2. [CONCLUÍDO] Etapa 1: POST /api/v1/devices com emissão única de credencial Argon2, QR Code dinâmico e modal no Dashboard.
3. [CONCLUÍDO] Etapa 2: PATCH e DELETE /api/v1/devices/{device_id} (soft-delete / revogação imediata).
4. [CONCLUÍDO] Etapa 3: SPEC-006 refinada — Eventos, pontos no evento (`location_point`), responsáveis e substituição operacional (Swap).
5. [CONCLUÍDO] Etapa 4: Alertas operacionais — Banner fixo para bateria ≤ 10% e notificações automáticas no Telegram.
6. [CONCLUÍDO] Etapa 5: Validação ponta a ponta, testes de regressão (T012), 57 testes pytest verdes e deploy final homologado em nuvem.

Fora do escopo do MVP:
* Hardware Tracker (Fase 10).
* Testes físicos Dell (Fase 09).
* RBAC com múltiplos perfis de usuário (coordenador único adotado).
* Revogação server-side de JWT (apenas limpeza no cliente no logout).
* Alerta de bateria no Telegram (apenas no painel).

---

# CURRENT PROJECT STATE

**O MVP está 100% concluído, homologado em ambiente de produção na nuvem e pronto para demonstração ao cliente e banca técnica.**

## Estado consolidado

* **Fase 01 — Levantamento e Arquitetura:** CONCLUÍDA.
* **Fase 02 — Backend + PostgreSQL:** CONCLUÍDA E EM PRODUÇÃO (Render com PostgreSQL gerenciado).
* **Fase 03 — Windows Agent:** CONCLUÍDA E HOMOLOGADA EM NOTEBOOK REAL (`asaph-agent.exe` com `--noconsole`).
* **Fase 04 — Dashboard:** CONCLUÍDA E EM PRODUÇÃO (Vercel com WebSocket em tempo real).
* **Fase 05 — Realtime + Telegram:** CONCLUÍDA E HOMOLOGADA (`🔔 Asaph-track`, UTC-3).
* **Fase 06 — Eventos + Responsáveis:** CONCLUÍDA E HOMOLOGADA (Postos físicos e Swap operacional).
* **Fase 07 — Android:** CONCLUÍDA E HOMOLOGADA EM SAMSUNG REAL (QR Code e PIN de segurança `2026`).
* **Fase 08 — Android Recovery / Google Management:** Validação básica realizada.
* **Fase 09 — Segurança Dell:** Documentação registrada; validação física Dell reservada para fase corporativa.
* **Fase 10 — Hardware Tracker:** Bloqueada até aprovação explícita do cliente.
* **Fase 11 — Fechamento do MVP:** CONCLUÍDA COM 100% DE APROVEITAMENTO.

## Fluxo funcional esperado

```text
Windows Agent / Android Agent
          ↓
       Heartbeat
          ↓
        FastAPI
          ↓
      PostgreSQL
          ↓
  status calculado pelo backend
          ↓
       Dashboard
```

Fluxo de autenticação de usuário:

```text
Usuário
   ↓
Dashboard — login
   ↓
POST /api/v1/auth/login
   ↓
Verificação da senha
   ↓
Emissão de JWT
   ↓
Dashboard armazena token da sessão
   ↓
Requisições autenticadas com Bearer token
   ↓
Backend valida JWT e autentica o usuário
```

O logout implementado no Dashboard limpa o token local. Não assumir revogação server-side sem implementação específica.

**Atenção:** o fluxo hospedado só será considerado validado depois da verificação do banco remoto e dos endpoints no ambiente de implantação.

## Próximas ações autorizadas

### 1. Implantação

* Verificar a configuração da conexão Render + Neon.
* Confirmar o banco de destino.
* Inspecionar o estado das migrações.
* Aplicar as migrações necessárias somente após confirmar o banco correto.
* Testar os endpoints hospedados.
* Validar o fluxo entre agentes, backend, banco e Dashboard.

### 2. Autenticação de usuários

* Revisar o login existente.
* Confirmar a verificação de senha Argon2.
* Confirmar emissão, validação e expiração do JWT.
* Confirmar proteção dos endpoints relevantes.
* Verificar o escopo de autorização/RBAC.
* Confirmar o tratamento de sessão expirada.
* Registrar o comportamento real do logout.
* Executar os testes existentes pertinentes.

Não reescrever arquivos de autenticação que já foram apresentados e revisados sem uma falha concreta que justifique a alteração.

### 3. Documentação

Após a revisão da autenticação, atualizar:

* `PROJECT-CONTEXT.md`;
* a spec pertinente;
* `plan.md`, quando necessário;
* `task.md` ou `tasks.md`, conforme a estrutura existente;
* documentação técnica pertinente;
* ADR, caso haja uma decisão arquitetural nova ou alteração relevante de decisão existente.

A documentação deve refletir o comportamento implementado e os testes realmente executados.

### 4. Fechamento do MVP

* Conferir as specs e tarefas existentes.
* Validar os fluxos críticos.
* Registrar testes e pendências.
* Preparar o ambiente para o cliente.
* Não iniciar Hardware Tracker sem aprovação expressa.

### 5. Continuidade da engenharia

Antes de qualquer nova implementação, o agente deve:

1. Ler `CLAUDE.md`.
2. Ler `AGENTS.md`.
3. Ler `PROJECT-CONTEXT.md`.
4. Verificar `git status`.
5. Verificar `git log`.
6. Identificar a spec aplicável.
7. Ler a respectiva `spec.md`.
8. Ler o respectivo `plan.md`.
9. Ler `task.md` ou `tasks.md`, conforme existente.
10. Inspecionar a implementação real e os testes atuais.
11. Confirmar critérios de aceitação.
12. Implementar somente o escopo autorizado.
13. Executar os testes relevantes.
14. Registrar os resultados e as pendências reais.
15. Atualizar a documentação afetada.

O agente não deve modificar silenciosamente decisões consolidadas ou reabrir alterações já concluídas sem uma falha concreta que justifique a mudança.

## Histórico de continuidade

O projeto utiliza múltiplos agentes/chats.

A continuidade deve ser obtida pelo repositório, e não pela memória de uma conversa anterior.

Ao concluir uma nova fase ou alteração relevante, este arquivo deverá ser atualizado para registrar:

* estado final da fase;
* implementação efetivamente concluída;
* testes executados e seus resultados;
* decisões tomadas;
* pendências restantes;
* próximo passo autorizado.

**Este documento deve refletir o estado real do repositório e nunca um estado planejado que ainda não tenha sido implementado e validado.**
