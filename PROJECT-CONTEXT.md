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

Equipment Monitor é uma plataforma para uma empresa que fornece/aluga equipamentos (notebooks Dell com Windows, smartphones Samsung com Android) para eventos corporativos e grandes eventos (Expo São Paulo, Expo Transamérica, Anhembi, etc.).

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

Android App ──► FastAPI

FastAPI ──► Telegram

FastAPI ──► Google / Android Management (futuro)

Infraestrutura planejada:

Docker + Docker Compose
PostgreSQL
autenticação JWT para usuários
autenticação própria para dispositivos
HTTPS em produção

O Windows Agent e o futuro Android App são clientes da API e não substituem a autoridade do backend sobre regras de negócio ou estado de comunicação.

3. Regras de negócio permanentes
#	Regra
01	Todo equipamento possui um patrimônio operacional (asset_number).
02	O patrimônio não é chave primária do banco.
03	Cada dispositivo possui um identificador técnico interno (PK própria).
04	Um equipamento pode participar de vários eventos ao longo da vida útil.
05	O relacionamento equipamento↔evento é feito via tabela de associação (event_devices), nunca por um event_id fixo dentro de devices.
06	Um equipamento pode ter diferentes responsáveis ao longo do tempo.
07	Histórico de comunicação (heartbeats) é preservado, nunca sobrescrito.
08	last_seen representa a última comunicação conhecida do dispositivo.
09	O backend decide o communication_status; o agente nunca decide sozinho que está offline.
10	O agente nunca se autodeclara offline.
11	Offline/sem comunicação não significa roubado.
12	Alertas e eventos importantes devem ser registrados.
13–14	Segredos nunca ficam em código; devem ser fornecidos por configuração/mecanismo seguro.
15	Senhas devem utilizar hash seguro (bcrypt/argon2).
16	Toda entrada externa deve ser validada.
17	Endpoints protegidos exigem autenticação.
18	Ações administrativas exigem autorização por papel/permissão (RBAC).

As regras acima não devem ser reinterpretadas por um agente sem justificativa arquitetural e, quando aplicável, atualização da ADR/spec correspondente.

4. Modelo conceitual
4.1 Entidades principais

Entidades principais atuais:

users
devices
events
event_devices
heartbeats
alerts

Entidades futuras possíveis:

employees
event_assignments
device_locations
device_commands
audit_logs
notification_channels
capabilities

Não adicionar campos ou entidades por antecipação. A necessidade deve ser demonstrada por uma spec.

4.2 Device

Modelo conceitual:

device

├── id (UUID, PK)

├── asset_number

├── type

├── manufacturer

├── model

├── serial_number

├── hostname

├── operating_system

├── battery_level

├── last_seen

├── operational_state

├── created_at

└── updated_at

asset_number não é chave primária.

communication_status não é armazenado como coluna persistida neste modelo. Ele é determinado pelo backend a partir da comunicação conhecida do dispositivo e das regras definidas na respectiva spec.

Não existe um campo genérico status para substituir esses conceitos.

4.3 Device Credential
device_credential

├── id

├── device_id (FK)

├── key_id (único, indexado)

├── secret_hash

├── status (ACTIVE/REVOKED)

├── created_at

├── revoked_at

└── last_used_at

A autenticação de dispositivo utiliza o par:

key_id + secret

O secret em sua forma original não é armazenado como credencial persistente pelo backend; o backend mantém o hash correspondente.

O formato de autenticação atualmente implementado é:

Authorization: DeviceKey <key_id>:<secret>

Detalhes arquiteturais estão registrados na ADR-006.

4.4 Heartbeat
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

received_at representa o momento em que o backend recebeu a comunicação.

source_ip representa o endereço observado pelo backend.

reported_ip, quando utilizado, representa informação fornecida pelo agente e não é tratado como fonte autoritativa.

device_timestamp é informativo e não substitui o timestamp de recebimento do servidor.

Detalhes relacionados a IP estão documentados na ADR-008.

4.5 Alert
alert

├── id

├── device_id

├── event_id

├── type

├── status

├── message

├── created_at

└── resolved_at
4.6 User
user

├── id

├── name

├── email

├── password_hash

├── role

├── created_at

└── updated_at
5. Fases do projeto
Fase	Objetivo	Status
01 — Levantamento e Arquitetura	PROJECT-CONTEXT, CLAUDE.md, AGENTS.md, ADRs iniciais e primeira spec	CONCLUÍDA
02 — Backend + PostgreSQL	FastAPI, SQLAlchemy, Alembic, Clean Architecture e SPEC-001 Device Heartbeat	CONCLUÍDA
03 — Windows Agent	Cliente Python de monitoramento para Windows, inicialmente com execução controlada	CONCLUÍDA
04 — Dashboard	React/Vite, consumo da API, lista, status, busca e filtros de equipamentos	CONCLUÍDA — MVP
05 — Realtime + Telegram	WebSocket, detecção de mudança de status e alertas Telegram	NÃO INICIADA
06 — Eventos + Responsáveis	CRUD de eventos, associação equipamento↔evento↔responsável	NÃO INICIADA
07 — Android	App Kotlin utilizando a mesma plataforma/backend	NÃO INICIADA
08 — Android Recovery / Google Management	Validação de Find Hub, Lost Mode e Android Management API	NÃO INICIADA
09 — Segurança Dell Nível 2	BIOS/TPM/BitLocker/Secure Boot e matriz de compatibilidade	NÃO INICIADA
10 — Hardware Tracker Nível 3	Só inicia após a Fase 08; decisão via ADR	BLOQUEADA ATÉ FASE 08
6. Estado das especificações
SPEC-001 — Device Heartbeat

Status:

CONCLUÍDA E IMPLEMENTADA

Artefatos:

specs/001-device-heartbeat/

├── spec.md

├── plan.md

└── tasks.md

A SPEC-001 define o contrato de heartbeat consumido pelos clientes de dispositivo.

SPEC-002 — Windows Agent

Status:

CONCLUÍDA E IMPLEMENTADA

Artefatos:

specs/002-windows-agent/

├── spec.md

├── plan.md

└── tasks.md

A SPEC-002 define o comportamento do cliente Windows responsável por tentar enviar telemetria/heartbeat ao backend.

O plan.md definiu a estratégia de implementação.

O tasks.md contém as tarefas de implementação, testes e revisão.

O TASKS-002 foi utilizado como fonte operacional para execução da Fase 03.

A implementação foi concluída e validada em ambiente de desenvolvimento.

7. Regras específicas da Fase 03 — Windows Agent

As regras completas da Fase 03 estão em:

specs/002-windows-agent/spec.md

specs/002-windows-agent/plan.md

specs/002-windows-agent/tasks.md

As regras abaixo são os invariantes mais importantes para a continuidade entre agentes.

7.1 Papel do Agent

O Windows Agent é um cliente de comunicação/telemetria.

Ele:

coleta os dados previstos pela SPEC-002;
tenta comunicar com o backend;
envia heartbeats conforme o contrato da SPEC-001;
trata falhas de comunicação de acordo com a spec;
mantém sua execução de forma controlada conforme definido pela Fase 03.

O Agent não é responsável por determinar o estado de comunicação do dispositivo.

7.2 Status de comunicação

O Agent:

não calcula communication_status;
não envia communication_status;
não determina ONLINE;
não determina SEM_COMUNICACAO;
não determina OFFLINE;
não altera o estado do dispositivo no backend.

O backend permanece como fonte de verdade para o estado de comunicação.

Falha na tentativa de comunicação pelo Agent representa uma falha de comunicação, não uma declaração de estado de negócio.

7.3 Histórico

O Agent não mantém histórico persistente de heartbeats.

A persistência e o histórico dos heartbeats pertencem ao backend.

Não implementar, nesta fase:

SQLite;
fila local;
store-and-forward;
banco local para heartbeats;
mecanismo equivalente de persistência de telemetria.
7.4 Asset Number

asset_number não faz parte da responsabilidade de identificação/comunicação do Agent nesta implementação.

Não utilizar patrimônio como chave primária ou mecanismo de autenticação do dispositivo.

7.5 Credencial do dispositivo

A autenticação do Agent utiliza o contrato definido na SPEC-001.

O secret:

não deve ser hardcoded;
não deve aparecer em logs;
não deve aparecer em argumentos de linha de comando;
não deve aparecer em URLs;
não deve ser exposto em mensagens de erro;
não deve ser transformado pelo Agent em hash para autenticação;
não deve ser validado criptograficamente pelo Agent.

O Agent utiliza a credencial conforme o contrato existente do backend.

7.6 Escopo

A Fase 03 não deve antecipar funcionalidades de fases posteriores.

Não implementar nesta fase:

dashboard;
WebSocket;
Telegram;
gerenciamento de eventos;
responsáveis;
Android;
Android Management;
rastreamento físico;
inventário avançado de hardware;
mecanismos de recuperação;
funcionalidades de segurança Dell de nível posterior.
8. Decisões e ambiguidades

Decisões arquiteturais consolidadas:

ADR-003 — Atomicidade do Heartbeat

Heartbeat e atualização de last_seen ocorrem na mesma transação.

Uma falha deve resultar em rollback da operação.

ADR-006 — Identidade e autenticação de dispositivo

Existe separação entre:

identidade interna do dispositivo (id);
identificador público da credencial (key_id);
segredo da credencial (secret).

O patrimônio não é identidade técnica.

O segredo não é chave primária.

ADR-007 — Comunicação vs. estado operacional

communication_status e operational_state representam conceitos diferentes.

communication_status

    ONLINE

    SEM_COMUNICACAO

    OFFLINE
operational_state

    ATIVO

    RECOLHIDO

    EM_MANUTENCAO

    DESATIVADO

Eles não devem ser fundidos em um único campo genérico status.

ADR-008 — IP observado vs. IP informado

source_ip representa o endereço observado pelo backend.

reported_ip representa informação enviada pelo dispositivo e não é considerada autoritativa.

Até que exista infraestrutura de proxy reverso confiável definida, o backend utiliza request.client.host.

X-Forwarded-For não é considerado nesta implementação atual.

9. Pendências de negócio e arquitetura

As seguintes questões permanecem abertas e não devem ser decididas arbitrariamente por um agente quando dependerem de decisão de negócio:

9.1 Responsável pelo equipamento

A REGRA 06 estabelece que um equipamento pode ter diferentes responsáveis ao longo do tempo.

Ainda não está definido se o responsável será:

um user do sistema; ou
um employee cadastrado sem acesso ao sistema.

Essa decisão pertence à spec de Eventos + Responsáveis da Fase 06.

9.2 Intervalo e threshold de heartbeat

O intervalo atual utilizado pelo Windows Agent no MVP é:

30 segundos

O cálculo atual do communication_status no backend utiliza:

last_seen <= 2 minutos
    → ONLINE

last_seen > 2 minutos e <= 5 minutos
    → SEM COMUNICAÇÃO

last_seen > 5 minutos
    → OFFLINE

last_seen inexistente
    → SEM REGISTRO

Esses valores devem permanecer configuráveis/evolutivos conforme definido pela arquitetura/spec correspondente.

Granularidade por dispositivo ou evento somente deve ser implementada se houver necessidade comprovada.

9.3 Proxy reverso / X-Forwarded-For

O tratamento de X-Forwarded-For permanece dependente da infraestrutura de produção.

Até que exista uma cadeia de proxy confiável definida, não alterar o comportamento atual de source_ip.

10. Fase 02 — Encerramento

A SPEC-001 (Device Heartbeat) foi implementada e teve seus critérios de aceitação comprovados por testes automatizados.

Estrutura

Backend Python/FastAPI utilizando uv e Clean Architecture pragmática:

domain

    ↓

application

    ↓

infrastructure

    ↓

interface / API
Infraestrutura
Docker Compose
PostgreSQL
Alembic
migrations para as estruturas necessárias ao Device Heartbeat
Domínio

Entidades implementadas:

Device
Heartbeat
DeviceCredential

As entidades de domínio não dependem diretamente do framework web.

Persistência

Repositórios SQLAlchemy implementam os ports definidos pela camada de aplicação.

A atomicidade do heartbeat foi comprovada:

heartbeat

+

last_seen

+

last_used_at

ocorrem dentro da mesma transação.

Autenticação

Autenticação de dispositivo implementada através de:

Authorization: DeviceKey <key_id>:<secret>

O backend utiliza Argon2 para armazenamento seguro do segredo.

API

Endpoint implementado:

POST /api/v1/heartbeats

Com:

autenticação de dispositivo;
validação de payload;
battery_level entre 0 e 100;
metadata limitada conforme contrato;
mapeamento de erros HTTP.

Endpoint adicional implementado para consumo do Dashboard:

GET /api/v1/devices

Esse endpoint retorna os dispositivos e o communication_status calculado pelo backend.

Testes

A Fase 02 possui:

33 testes automatizados

incluindo:

testes unitários;
testes de integração com PostgreSQL real;
testes de API através de TestClient.

Os testes de integração/API não substituem o banco real por mocks.

Seed

Existe um script manual para criação de dispositivo/credencial de teste:

backend/scripts/seed_device.py
11. Fase 03 — Windows Agent: estado concluído

A Fase 03 foi implementada e validada.

Artefatos:

specs/002-windows-agent/spec.md

specs/002-windows-agent/plan.md

specs/002-windows-agent/tasks.md

O Windows Agent foi validado em ambiente de desenvolvimento utilizando execução controlada.

Comando utilizado:

python .\agent_pilot.py

Exemplo de execução validada:

Agent iniciado; destino=http://localhost:8000 intervalo=30s
Heartbeat aceito (HTTP 201)

O Agent envia heartbeat aproximadamente a cada 30 segundos.

O Agent não calcula nem envia communication_status.

O backend continua sendo a autoridade para determinar:

ONLINE
SEM COMUNICAÇÃO
OFFLINE

A Fase 03 não introduziu:

SQLite;
fila local;
store-and-forward;
Dashboard;
WebSocket;
Telegram;
Eventos;
Android.
12. Fase 04 — Dashboard: estado concluído

A Fase 04 foi implementada como MVP funcional.

O Dashboard atualmente utiliza:

React + Vite
    ↓
Axios
    ↓
FastAPI REST API
12.1 Funcionalidades implementadas
listagem de equipamentos;
patrimônio;
hostname;
IP;
bateria;
último contato;
status de comunicação;
cards de resumo;
busca por patrimônio;
busca por hostname;
busca por IP;
filtros por status;
polling automático;
tratamento básico de carregamento;
tratamento básico de erro;
layout responsivo básico.
12.2 Status

O Dashboard exibe:

ONLINE

SEM COMUNICAÇÃO

OFFLINE

O backend também pode retornar:

SEM REGISTRO

quando um equipamento ainda não possui last_seen.

O Dashboard não calcula o status.

A responsabilidade permanece exclusivamente no backend.

12.3 Polling

O Dashboard realiza uma consulta inicial à API e posteriormente atualiza os dados automaticamente a cada:

30 segundos

O polling permite que uma mudança de comunicação seja refletida no Dashboard sem refresh manual da página.

WebSocket ainda não foi implementado.

A implementação de WebSocket permanece planejada para uma fase posterior.

12.4 Busca

A busca do Dashboard permite procurar por:

asset_number
hostname
reported_ip
12.5 Filtros

Os filtros disponíveis são:

TODOS
ONLINE
SEM COMUNICAÇÃO
OFFLINE

A filtragem é somente para apresentação dos dados.

12.6 Validação funcional

O fluxo completo foi validado com o Windows Agent e o Dashboard.

Cenário validado:

Agent executando
        ↓
ONLINE
        ↓
Agent interrompido
        ↓
SEM COMUNICAÇÃO
        ↓
passagem do threshold
        ↓
OFFLINE
        ↓
Agent reiniciado
        ↓
ONLINE

A alteração de estado ocorreu automaticamente através do polling, sem necessidade de atualizar manualmente a página.

Esse teste confirmou a integração funcional entre:

Windows Agent
    ↓
FastAPI
    ↓
PostgreSQL
    ↓
cálculo de status
    ↓
GET /api/v1/devices
    ↓
Dashboard
    ↓
polling automático
13. Estado atual da implementação
Backend

Implementado e funcional:

FastAPI;
PostgreSQL;
SQLAlchemy;
Alembic;
Docker Compose;
Clean Architecture pragmática;
autenticação de dispositivo;
heartbeat;
persistência;
atomicidade;
validações;
endpoint POST /api/v1/heartbeats;
endpoint GET /api/v1/devices;
cálculo backend de communication_status.
Windows Agent

Implementado e validado:

execução controlada;
coleta de dados;
heartbeat;
autenticação;
comunicação com backend;
intervalo de aproximadamente 30 segundos;
tratamento de falhas de comunicação.
Dashboard

Implementado e validado como MVP:

React;
Vite;
Axios;
listagem de equipamentos;
status;
cards;
busca;
filtros;
polling de 30 segundos;
layout responsivo básico.
14. Funcionalidades ainda não implementadas

Ainda não foram implementados:

WebSocket;
Telegram;
autenticação JWT de usuários;
RBAC funcional;
CRUD de eventos;
associação equipamento↔evento;
responsáveis;
aplicativo Android;
Android Management;
Find Hub / Lost Mode;
segurança Dell Nível 2;
Hardware Tracker Nível 3;
rastreamento físico;
comandos remotos;
localização de dispositivos;
auditoria avançada.

Essas funcionalidades não devem ser antecipadas sem a respectiva spec/planejamento.

CURRENT PROJECT STATE

Fase atual:

FASE 04 — Dashboard

Status:

CONCLUÍDA — MVP

Última fase concluída:

FASE 04 — Dashboard MVP

Fases anteriores concluídas:

FASE 01 — Levantamento e Arquitetura
FASE 02 — Backend + PostgreSQL
FASE 03 — Windows Agent

Última spec concluída:

SPEC-002 — Windows Agent

Último incremento funcional concluído:

Dashboard MVP

Estado funcional atual:

Windows Agent
      ↓
Heartbeat
      ↓
FastAPI
      ↓
PostgreSQL
      ↓
GET /api/v1/devices
      ↓
Dashboard React/Vite
      ↓
Polling automático
      ↓
ONLINE / SEM COMUNICAÇÃO / OFFLINE

Próxima fase:

A próxima implementação deve ser definida a partir das specs/planos existentes no repositório.

Não assumir funcionalidades novas sem consultar a respectiva SPEC/PLAN/TASKS.

Implementado
Fase 01
estrutura inicial do repositório;
PROJECT-CONTEXT.md;
CLAUDE.md;
AGENTS.md;
ADRs iniciais;
SPEC-001;
SPEC-002 e seus artefatos de planejamento;
versionamento Git;
.gitignore.
Fase 02
backend FastAPI;
Clean Architecture pragmática;
PostgreSQL;
Docker Compose;
Alembic;
entidades Device, Heartbeat e DeviceCredential;
autenticação de dispositivo;
endpoint de heartbeat;
persistência;
atomicidade;
validações;
testes automatizados;
seed manual de dispositivo;
endpoint GET /api/v1/devices;
serviço backend de cálculo de communication_status.
Fase 03
Windows Agent;
execução controlada;
coleta de telemetria;
comunicação com backend;
envio de heartbeat;
autenticação;
intervalo de aproximadamente 30 segundos;
tratamento de falhas de comunicação;
validação funcional contra backend real.
Fase 04
Dashboard React/Vite;
integração REST com FastAPI;
listagem de equipamentos;
patrimônio;
hostname;
IP;
bateria;
último contato;
status de comunicação;
cards de status;
busca por patrimônio;
busca por hostname;
busca por IP;
filtros por status;
polling automático a cada 30 segundos;
tratamento básico de loading;
tratamento básico de erro;
layout responsivo básico;
validação do fluxo ONLINE;
validação do fluxo SEM COMUNICAÇÃO;
validação do fluxo OFFLINE;
validação do retorno para ONLINE após reinício do Agent.
Testes
Fase 01

Não possui implementação funcional própria a ser testada.

Fase 02

33 testes automatizados implementados e executados como parte da conclusão da SPEC-001.

Incluem:

testes unitários;
testes de integração;
testes de API;
PostgreSQL real nos testes de integração/API aplicáveis.
Fase 03

Windows Agent validado em execução real no ambiente de desenvolvimento.

Fluxo validado:

Agent iniciado
    ↓
HTTP 201
    ↓
heartbeat aceito

Também foi validado o comportamento do backend/Dashboard quando o Agent é interrompido.

Fase 04

Dashboard validado funcionalmente com o backend e Windows Agent.

Fluxo validado:

ONLINE
    ↓
Agent interrompido
    ↓
SEM COMUNICAÇÃO
    ↓
OFFLINE
    ↓
Agent reiniciado
    ↓
ONLINE

A atualização ocorreu automaticamente através do polling, sem refresh manual.

Decisões importantes
Clean Architecture pragmática com separação Domain / Application / Infrastructure / Interface.
asset_number não é PK.
Dispositivo possui PK interna própria (id UUID).
Autenticação de dispositivo utiliza key_id + secret.
O backend armazena hash seguro do segredo.
communication_status e operational_state são conceitos separados.
communication_status é determinado pelo backend.
Agentes nunca calculam nem enviam communication_status.
Agentes nunca se autodeclaram offline.
Heartbeat + atualização de last_seen ocorrem na mesma transação.
source_ip atualmente utiliza o endereço observado pelo backend.
reported_ip é informação fornecida pelo agente e não é autoritativa.
X-Forwarded-For não é utilizado sem infraestrutura de proxy confiável.
Dependências Python são gerenciadas com uv (pyproject.toml + uv.lock).
O Windows Agent não mantém histórico persistente de heartbeats.
A Fase 03 não introduziu SQLite, fila local ou store-and-forward.
O Dashboard MVP utiliza polling HTTP a cada 30 segundos.
O Dashboard não calcula communication_status.
WebSocket ainda não foi implementado.
Telegram ainda não foi implementado.
Eventos e responsáveis ainda não foram implementados.
O repositório é a fonte de verdade entre diferentes agentes/chats.
Próximo passo

Com as Fases 01, 02, 03 e o MVP da Fase 04 concluídos, o próximo passo é iniciar a próxima capacidade do produto conforme as especificações existentes no repositório.

Antes de qualquer nova implementação, o agente deve:

Ler CLAUDE.md.
Ler AGENTS.md.
Ler PROJECT-CONTEXT.md.
Verificar git status.
Verificar git log.
Identificar a próxima SPEC aplicável.
Ler a respectiva spec.md.
Ler o respectivo plan.md.
Ler o respectivo tasks.md.
Inspecionar a implementação real existente.
Confirmar os critérios de aceitação.
Somente então iniciar a implementação autorizada.

O agente não deve modificar silenciosamente decisões já consolidadas ou contratos existentes.

Qualquer alteração arquitetural relevante deve ser registrada na documentação correspondente e, quando aplicável, em uma nova ADR.

Histórico de continuidade

O projeto utiliza múltiplos agentes/chats.

A continuidade deve ser obtida pelo repositório, e não pela memória de uma conversa anterior.

Estado consolidado:

FASE 01
Levantamento e Arquitetura
        ↓
CONCLUÍDA

FASE 02
Backend + PostgreSQL
        ↓
CONCLUÍDA

FASE 03
Windows Agent
        ↓
CONCLUÍDA

FASE 04
Dashboard MVP
        ↓
CONCLUÍDA

PRÓXIMA
Nova capacidade conforme SPEC/PLAN/TASKS
        ↓
A DEFINIR / INICIAR

Ao concluir uma nova fase, este arquivo deverá ser atualizado novamente para registrar:

status final da fase;
implementação efetivamente concluída;
testes executados;
decisões tomadas;
pendências restantes;
próximo passo do projeto.

Este documento deve refletir o estado real do repositório e nunca um estado planejado que ainda não tenha sido implementado e validado.