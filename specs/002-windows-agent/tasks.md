# TASKS-002 — Windows Agent

Spec: `specs/002-windows-agent/spec.md`
Plan: `specs/002-windows-agent/plan.md`
Contrato consumido: `SPEC-001 — Device Heartbeat`
Status: READY FOR IMPLEMENTATION
Fase: 03 — Windows Agent

---

## 0. Regras de execução

### Fluxo obrigatório

A implementação deve seguir:

`TASK → IMPLEMENT → TEST → REVIEW → COMMIT`

Cada grupo de tarefas deve permanecer funcional antes do próximo grupo.

### Regras arquiteturais obrigatórias

* O Agent somente tenta comunicar com o backend.
* O Agent nunca calcula `communication_status`.
* O Agent nunca envia `communication_status`.
* O Agent nunca se declara `OFFLINE`.
* O backend continua sendo a fonte de verdade para o estado de comunicação.
* O Agent não mantém histórico persistente de heartbeats.
* Não implementar SQLite, fila local ou store-and-forward.
* Não alterar a SPEC-001 ou o backend da Fase 02.
* `asset_number` não faz parte desta implementação.
* O `secret` nunca pode aparecer em código, logs, argumentos ou URL.
* O Agent não faz hash nem valida criptograficamente o `secret`.
* Não adicionar inventário de hardware nesta fase.
* Não adicionar `device_timestamp`.
* Não criar ADR sem necessidade arquitetural real.

### Correções QA incorporadas às tasks

1. `SUCCESS` → zera contador de falhas transitórias.
2. `REJECTED` (`401`, `422`, demais `4xx` e `3xx`) → zera contador e aguarda intervalo normal.
3. `TRANSIENT` → incrementa contador e utiliza exponential backoff.
4. Exceções transitórias → incrementam contador e utilizam backoff.
5. Nunca implementar a regra "qualquer resposta HTTP zera o contador".
6. Não assumir que o shutdown sempre termina em ≤20s. O `stop_event` deve interromper esperas; uma requisição/rede em andamento pode depender do comportamento do SO.
7. Não alterar automaticamente o AC-12 para `onedir`. O `onefile` será validado pelo spike.
8. Não assumir `OFFLINE_THRESHOLD_SECONDS >= 3x` sem confirmar a SPEC-001.
9. O tratamento do corpo `422` deve respeitar limite seguro de logging, sem expor segredo.

---

# FASE 0 — Spike obrigatório de Windows Service + PyInstaller

## T002-01 — Criar spike mínimo do Windows Service

**Objetivo:** validar a combinação `pywin32 + Windows Service`.

* Criar `interface/service.py` mínimo.
* Utilizar `win32serviceutil.ServiceFramework`.
* Implementar `SvcDoRun`.
* Implementar `SvcStop`.
* Utilizar `threading.Event`.
* Registrar mensagem simples no Event Log.
* Não implementar ainda heartbeat.
* Não implementar telemetria.
* Não implementar configuração definitiva.

**Aceite:**

* Serviço instala.
* Serviço inicia.
* Serviço permanece executando.
* Serviço recebe `stop`.
* Serviço encerra sem crash.
* Não existe janela de console durante execução como serviço.

---

## T002-02 — Validar PyInstaller `--onefile`

Criar build mínimo usando:

`PyInstaller --onefile`

Validar:

* geração do `.exe`;
* instalação do serviço;
* inicialização;
* parada;
* remoção;
* reboot do Windows.

**Gate:**

O spike deve verificar:

1. ausência do erro 1053;
2. parada funcional;
3. comportamento após 5 reboots;
4. comportamento de diretórios `_MEI*`;
5. Windows Defender não bloqueando o artefato.

**Decisão:**

* Se `--onefile` funcionar → manter AC-12.
* Se `--onefile` falhar → parar e reportar QA antes de trocar para `onedir`.

Não alterar o contrato silenciosamente.

---

## T002-03 — Validar Python + PyInstaller + pywin32

Verificar compatibilidade da combinação utilizada.

Preferência:

* Python >= 3.12.
* Testar Python 3.13.
* Se houver incompatibilidade relevante → fixar Python 3.12 no ambiente `uv`.

Registrar a decisão no README técnico.

---

## T002-04 — Gate do Spike

Antes de continuar:

* [ ] Serviço instala.
* [ ] Serviço inicia.
* [ ] Serviço para.
* [ ] Serviço reinicia.
* [ ] Serviço inicia após reboot.
* [ ] PyInstaller gera executável.
* [ ] Defender não bloqueia.
* [ ] Não há problema crítico com `_MEI*`.
* [ ] Compatibilidade Python definida.

**Se algum item crítico falhar:** parar implementação e reportar ao QA.

---

# FASE 1 — Esqueleto do projeto

## T002-05 — Criar estrutura `windows-agent`

Criar:

```text
windows-agent/
├── pyproject.toml
├── uv.lock
├── config.example.toml
├── README.md
├── scripts/
│   └── build.ps1
├── agent/
│   ├── domain/
│   │   ├── payload.py
│   │   ├── backoff.py
│   │   └── outcome.py
│   ├── application/
│   │   ├── ports.py
│   │   └── runner.py
│   ├── infrastructure/
│   │   ├── config.py
│   │   ├── telemetry.py
│   │   ├── http_sender.py
│   │   └── logging_setup.py
│   └── interface/
│       └── service.py
└── tests/
    ├── unit/
    └── integration/
```

---

## T002-06 — Configurar dependências

Runtime:

* `pywin32` apenas em Windows.

Build:

* `pyinstaller`.

Dev/test:

* `pytest`.

Evitar dependências adicionais sem justificativa.

---

## T002-07 — Configurar `.gitignore`

Ignorar:

```text
agent.toml
**/agent.toml
dist/
build/
*.log
__pycache__/
.pytest_cache/
```

Garantir que nenhuma credencial possa ser adicionada acidentalmente ao Git.

---

# FASE 2 — Domínio

## T002-08 — Implementar modelo do heartbeat

Criar modelo interno representando somente:

```text
hostname
battery_level
reported_ip
```

Regras:

* somente campos presentes são serializados;
* nenhum `communication_status`;
* nenhum `device_timestamp`;
* nenhum campo inventado.

---

## T002-09 — Implementar `Outcome`

Criar resultado interno:

```text
SUCCESS
TRANSIENT
REJECTED
```

O resultado deve carregar informações suficientes para o Runner decidir a próxima espera.

---

## T002-10 — Implementar exponential backoff

Implementar:

```text
1s
2s
4s
8s
16s
30s
30s...
```

Com equal jitter:

```text
[base/2, base]
```

Regras:

* nunca ultrapassar 30s;
* contador somente para falhas `TRANSIENT`;
* `SUCCESS` zera contador;
* `REJECTED` zera contador.

---

## T002-11 — Testar domínio

Testar:

* primeiro backoff;
* segundo;
* quarto;
* teto de 30s;
* jitter;
* reset após sucesso;
* reset após rejeição;
* sequência de 100 falhas sem quebrar.

---

# FASE 3 — Configuração

## T002-12 — Implementar parser TOML

Arquivo padrão:

```text
%PROGRAMDATA%\EquipmentMonitor\agent.toml
```

Override para desenvolvimento/testes:

```text
EQUIPMENT_MONITOR_AGENT_CONFIG
```

---

## T002-13 — Implementar validação

Validar:

### `key_id`

* obrigatório;
* não vazio;
* sem espaços;
* sem `:`;
* sem caracteres de controle.

### `secret`

* obrigatório;
* não vazio;
* sem caracteres de controle;
* sem quebra de linha.

### `backend_url`

* obrigatório;
* possuir host;
* sem credenciais;
* sem query;
* sem fragment.

HTTPS obrigatório por padrão.

### `heartbeat_interval_seconds`

* padrão: `30`;
* mínimo: `5`;
* máximo: `300`.

### `log_level`

Valores:

```text
DEBUG
INFO
WARNING
ERROR
```

### `allow_insecure_http`

Padrão:

```text
false
```

Quando habilitado explicitamente:

* permitir HTTP somente para cenário controlado de desenvolvimento/teste;
* emitir WARNING no início;
* nunca desabilitar validação TLS para HTTPS.

---

## T002-14 — Rejeitar configuração insegura

Testar:

* campo ausente;
* valor vazio;
* placeholder;
* intervalo inválido;
* URL inválida;
* credenciais na URL;
* HTTP sem autorização explícita;
* caracteres de controle;
* segredo com newline.

Mensagens de erro nunca devem mostrar valores sensíveis.

---

## T002-15 — Configuração fora do build

Garantir:

* `agent.toml` não entra no `.exe`;
* `config.example.toml` contém apenas placeholders;
* nenhum segredo é utilizado durante o build;
* nenhum segredo aparece em `argv`;
* nenhum segredo aparece em nome de arquivo;
* nenhum segredo aparece em URL.

---

## T002-16 — Testes de configuração

Cobrir AC-01 e AC-13.

---

# FASE 4 — Telemetria

## T002-17 — Implementar hostname

Fonte:

```python
socket.gethostname()
```

Regras:

* máximo 255 caracteres;
* vazio/erro → campo omitido;
* falha não interrompe o heartbeat.

---

## T002-18 — Implementar bateria

Utilizar:

```text
kernel32.GetSystemPowerStatus
```

via `ctypes`.

Regras:

* `BatteryFlag == 128` → omitido;
* `BatteryLifePercent == 255` → omitido;
* clamp entre 0 e 100;
* erro → omitido.

---

## T002-19 — Implementar `reported_ip`

Utilizar socket UDP com destino:

```text
192.0.2.1
```

Somente para determinar a rota local.

Regras:

* nenhum pacote deve ser enviado;
* utilizar `getsockname()`;
* validar com `ipaddress`;
* rejeitar loopback;
* rejeitar link-local;
* rejeitar unspecified;
* falha → campo omitido.

---

## T002-20 — Isolar coletores

Cada coletor deve ser independente.

Falha em:

```text
hostname
```

não pode impedir:

```text
battery_level
reported_ip
```

---

## T002-21 — Testes de telemetria

Testar:

* hostname válido;
* hostname vazio;
* erro do SO;
* equipamento sem bateria;
* bateria desconhecida;
* bateria válida;
* erro na bateria;
* IP válido;
* ausência de rota;
* loopback;
* link-local;
* exceção inesperada.

---

# FASE 5 — HTTP Sender

## T002-22 — Implementar cliente HTTP

Utilizar:

```text
urllib.request
```

Enviar:

```http
POST /api/v1/heartbeats
Authorization: DeviceKey <key_id>:<secret>
Content-Type: application/json
User-Agent: EquipmentMonitorAgent/<version>
```

Timeout:

```text
10 segundos
```

---

## T002-23 — Impedir redirects automáticos

O cliente não deve seguir redirects.

Objetivo:

* evitar reenviar `Authorization` para outro host;
* tornar configuração incorreta visível.

---

## T002-24 — Implementar serialização

Enviar somente:

```text
hostname
battery_level
reported_ip
```

Campos indisponíveis devem ser omitidos.

Payload `{}` permanece tecnicamente possível se nenhum campo puder ser coletado, conforme o contrato definido no plano.

---

## T002-25 — Implementar classificação HTTP

### SUCCESS

```text
2xx
```

→ `SUCCESS`

### TRANSIENT

```text
408
429
5xx
timeout
DNS
connection refused
TLS failure
```

→ `TRANSIENT`

### REJECTED

```text
401
422
outros 4xx
3xx
```

→ `REJECTED`

Não seguir redirects.

---

## T002-26 — Tratamento seguro de respostas

Para `422` e demais respostas que precisem de diagnóstico:

* ler corpo somente quando necessário;
* limitar tamanho registrado;
* máximo de 1000 caracteres;
* nunca registrar credenciais;
* nunca registrar header `Authorization`.

---

## T002-27 — Testes HTTP

Testar:

* método;
* endpoint;
* header;
* payload;
* 201;
* 401;
* 422;
* 400;
* 404;
* 429;
* 500;
* timeout;
* conexão recusada;
* DNS;
* redirect.

---

# FASE 6 — Heartbeat Runner

## T002-28 — Implementar ports

Criar interfaces para:

```text
Telemetry
Sender
```

O Runner não deve depender diretamente de:

* Windows;
* socket real;
* HTTP real;
* filesystem.

---

## T002-29 — Implementar ciclo principal

Fluxo:

```text
coletar
↓
enviar
↓
classificar resultado
↓
registrar
↓
calcular espera
↓
stop_event.wait()
↓
próximo ciclo
```

Uma tentativa HTTP por ciclo.

---

## T002-30 — Implementar comportamento de sucesso

Ao receber `SUCCESS`:

* zerar contador;
* utilizar intervalo configurado;
* registrar sucesso conforme política de logging.

---

## T002-31 — Implementar comportamento transitório

Ao receber `TRANSIENT`:

* incrementar contador;
* calcular backoff;
* aguardar backoff;
* continuar executando;
* nunca encerrar o serviço.

---

## T002-32 — Implementar comportamento rejeitado

Ao receber `REJECTED`:

* zerar contador;
* não aplicar backoff;
* aguardar intervalo normal;
* continuar executando.

---

## T002-33 — Implementar exceção de segurança

Exceção inesperada:

* capturar `Exception`;
* registrar traceback com redação;
* classificar como `TRANSIENT`;
* aplicar backoff;
* manter o processo vivo.

Não capturar `BaseException`.

---

## T002-34 — Implementar parada interruptível

Todas as esperas devem utilizar:

```text
stop_event.wait(timeout)
```

Nunca utilizar `time.sleep()` no loop principal.

A parada deve interromper imediatamente uma espera de backoff ou intervalo.

Uma requisição de rede já em andamento pode depender do timeout/comportamento do sistema operacional.

---

## T002-35 — Testes do Runner

Cobrir:

* sucesso contínuo;
* falha transitória;
* sequência de falhas;
* recuperação;
* 401;
* 422;
* 4xx;
* 3xx;
* exceção inesperada;
* 100+ falhas;
* stop durante espera;
* reset do contador;
* teto de 30s.

---

# FASE 7 — Logging

## T002-36 — Implementar logging

Arquivo:

```text
%PROGRAMDATA%\EquipmentMonitor\logs\agent.log
```

Rotação:

```text
5 MiB
5 backups
```

Formato:

```text
UTC ISO-8601 · nível · logger · mensagem
```

UTF-8.

---

## T002-37 — Implementar redação de informações sensíveis

O filtro deve impedir que apareçam nos logs:

```text
secret
key_id
Authorization
```

Também verificar traceback e `exc_text`.

---

## T002-38 — Implementar política de repetição

Primeira falha:

```text
WARNING/ERROR
```

Repetições idênticas:

```text
DEBUG
```

A cada 20 falhas consecutivas:

```text
WARNING/ERROR
```

Recuperação:

```text
INFO
```

Mensagem neutra.

Nunca utilizar termos que indiquem furto, roubo ou situação semelhante.

---

## T002-39 — Implementar fallback Event Log

Se arquivo de log não puder ser gravado:

* registrar no Windows Event Log;
* não derrubar o Agent;
* continuar enviando heartbeat.

Durante runtime:

* no máximo um alerta de Event Log por hora;
* nunca propagar erro do sistema de logging para o Runner.

---

## T002-40 — Testes de logging

Verificar:

* rotação;
* limite de tamanho;
* níveis;
* redação;
* traceback;
* `secret`;
* `key_id`;
* falha de filesystem;
* fallback Event Log.

---

# FASE 8 — Windows Service definitivo

## T002-41 — Implementar `service.py`

Utilizar:

```text
win32serviceutil.ServiceFramework
servicemanager
```

Nome:

```text
EquipmentMonitorAgent
```

Display name:

```text
Equipment Monitor Agent
```

---

## T002-42 — Implementar comandos

Suportar:

```text
install
update
remove
start
stop
restart
debug
```

`debug` deve permitir execução interativa para diagnóstico.

Não executar `debug` simultaneamente com o serviço usando o mesmo arquivo de log.

---

## T002-43 — Implementar startup automático

Configurar:

```text
--startup auto
```

O serviço deve iniciar automaticamente com o Windows.

---

## T002-44 — Implementar conta do serviço

Preferência:

```text
LocalService
```

Documentar fallback para:

```text
LocalSystem
```

somente quando necessário.

---

## T002-45 — Implementar shutdown

Implementar:

```text
SvcStop
SvcShutdown
```

Ambos devem sinalizar:

```text
stop_event.set()
```

Não enviar heartbeat de despedida.

Não enviar:

```text
offline
```

ou equivalente.

---

## T002-46 — Configurar recuperação do serviço

Configurar política de recovery conforme definido no plano:

```text
5s
5s
60s
reset 1 dia
```

Validar que configuração inválida não produz loop indesejado de restart.

---

# FASE 9 — Segurança operacional

## T002-47 — Configurar ACL da configuração

Documentar e validar ACL restrita para:

```text
%PROGRAMDATA%\EquipmentMonitor\agent.toml
```

Validar a sintaxe efetiva de `icacls` no Windows antes de documentá-la como procedimento definitivo.

---

## T002-48 — Auditoria de segredo

Executar busca no projeto para garantir que o secret não aparece em:

* código;
* testes;
* logs;
* argumentos;
* documentação;
* `.exe`;
* scripts;
* nomes de arquivos;
* URLs.

---

## T002-49 — Teste de configuração exemplo

Garantir que:

```text
config.example.toml
```

contenha apenas placeholders.

Nenhum valor real.

---

# FASE 10 — Build

## T002-50 — Criar `build.ps1`

Build deve:

1. limpar artefatos anteriores;
2. executar testes;
3. gerar `.exe`;
4. colocar resultado em `dist/`;
5. não incluir configuração;
6. não incluir segredo.

---

## T002-51 — Validar artefato

Inspecionar o `.exe` para confirmar:

* credenciais ausentes;
* config real ausente;
* execução;
* instalação;
* startup;
* stop;
* restart.

---

# FASE 11 — Integração com SPEC-001

## T002-52 — Contract test

Confirmar que o payload produzido pelo Agent permanece subconjunto do contrato:

```text
hostname
battery_level
reported_ip
```

Não adicionar campos.

---

## T002-53 — Validar autenticação real

Utilizar uma credencial real de teste criada pelo mecanismo existente da Fase 02.

Validar:

```text
Authorization: DeviceKey <key_id>:<secret>
```

Não modificar backend.

---

## T002-54 — Validar 401

Revogar/inutilizar a credencial de teste.

Confirmar:

* Agent recebe 401;
* registra erro sem segredo;
* não encerra;
* não entra em backoff;
* continua no intervalo normal.

---

## T002-55 — Validar 422

Provocar uma resposta 422 controlada somente no ambiente de teste.

Confirmar:

* Agent não crasha;
* resposta é registrada dentro do limite seguro;
* credenciais não aparecem;
* próximo ciclo ocorre normalmente.

---

# FASE 12 — E2E

## T002-56 — Preparar ambiente E2E

Utilizar:

```text
docker compose
seed_device.py
```

e backend da Fase 02.

---

## T002-57 — E2E heartbeat

Validar:

```text
Agent
  ↓
POST /api/v1/heartbeats
  ↓
Backend
  ↓
persistência do heartbeat
```

Conferir os registros no banco.

---

## T002-58 — E2E indisponibilidade

Parar o backend.

Confirmar:

* Agent continua executando;
* backoff funciona;
* nenhum heartbeat atrasado é armazenado localmente;
* nenhum `communication_status` é produzido pelo Agent.

Restaurar backend.

Confirmar recuperação automática.

---

## T002-59 — Validar preservação histórica

Parar/reiniciar backend conforme o cenário de teste.

Confirmar que heartbeats previamente persistidos permanecem intactos.

Essa propriedade pertence ao backend/SPEC-001; o Agent não deve implementar mecanismo próprio para isso.

---

# FASE 13 — Teste manual Windows

## T002-60 — Instalação limpa

Checklist:

* [ ] copiar `.exe`;
* [ ] criar `agent.toml`;
* [ ] validar permissões;
* [ ] instalar serviço;
* [ ] iniciar serviço;
* [ ] verificar Event Viewer;
* [ ] verificar log;
* [ ] confirmar heartbeat no backend.

---

## T002-61 — Reboot

Executar:

```text
shutdown/reboot
```

Confirmar:

* serviço inicia automaticamente;
* Agent volta a enviar heartbeat;
* nenhuma intervenção manual necessária.

---

## T002-62 — Alteração do intervalo

Alterar:

```text
heartbeat_interval_seconds
```

Reiniciar serviço.

Confirmar nova cadência sem recompilar o `.exe`.

Isso comprova AC-13.

---

## T002-63 — Falha de configuração

Remover ou invalidar configuração.

Reiniciar serviço.

Confirmar:

* erro registrado;
* serviço não envia heartbeat;
* serviço não entra em loop de restart;
* credencial nunca aparece no log.

---

## T002-64 — Teste de credencial inválida

Usar credencial inválida/revogada.

Confirmar:

* 401;
* serviço continua;
* sem crash;
* sem backoff;
* sem segredo no log.

---

## T002-65 — Teste de rede

Testar:

* backend indisponível;
* DNS indisponível;
* conexão recusada;
* timeout;
* backend retornando 500.

Confirmar exponential backoff.

---

# FASE 14 — Revisão QA

## T002-66 — Executar suíte automatizada

Executar:

```text
pytest
```

Critério:

```text
0 failures
```

---

## T002-67 — Revisão de arquitetura

Verificar:

* [ ] `service.py` é o único módulo dependente de `win32*`;
* [ ] domínio não depende de Windows;
* [ ] Runner não depende de HTTP concreto;
* [ ] Runner não depende de filesystem;
* [ ] telemetria possui isolamento;
* [ ] não existe persistência local;
* [ ] não existe lógica de status;
* [ ] não existe lógica de inventário.

---

## T002-68 — Revisão de segurança

Verificar:

* [ ] nenhum secret hardcoded;
* [ ] nenhum secret em log;
* [ ] nenhum secret em URL;
* [ ] nenhum secret em argv;
* [ ] nenhuma configuração real no Git;
* [ ] HTTPS padrão;
* [ ] redirect não seguido;
* [ ] timeout configurado;
* [ ] ACL documentada;
* [ ] `.exe` não contém credenciais.

---

## T002-69 — Revisão dos critérios de aceitação

Mapear explicitamente:

| AC    | Evidência                             |
| ----- | ------------------------------------- |
| AC-01 | Testes de configuração + teste manual |
| AC-02 | Integration HTTP                      |
| AC-03 | Contract test                         |
| AC-04 | Unit de telemetria                    |
| AC-05 | Unit/Integration de backoff           |
| AC-06 | Teste de falhas prolongadas           |
| AC-07 | Teste 401                             |
| AC-08 | Teste 422                             |
| AC-09 | Contract/security scan                |
| AC-10 | E2E/backend                           |
| AC-11 | Log security test                     |
| AC-12 | Spike + E2E Windows                   |
| AC-13 | Teste de alteração de configuração    |

---

# FASE 15 — Documentação

## T002-70 — Atualizar README

Documentar:

* instalação;
* configuração;
* criação da configuração;
* permissões;
* instalação do serviço;
* comandos;
* start/stop/restart;
* debug;
* logs;
* troubleshooting;
* desinstalação;
* recuperação do serviço;
* alteração do intervalo.

---

## T002-71 — Documentar limitações

Registrar explicitamente:

* sem store-and-forward;
* sem histórico local;
* sem inventário de hardware;
* sem `communication_status`;
* sem onboarding automático;
* sem MSI;
* `reported_ip` é apenas informativo;
* secret atualmente armazenado em arquivo local protegido por ACL;
* assinatura digital do `.exe` fora do escopo desta fase.

---

## T002-72 — Atualizar `PROJECT-CONTEXT.md`

Somente se houver decisão permanente da arquitetura que deva ser registrada no contexto global.

Não duplicar detalhes de implementação desnecessariamente.

---

# FASE 16 — Commit e encerramento

## T002-73 — Revisão final do diff

Verificar:

* código;
* testes;
* documentação;
* `.gitignore`;
* ausência de credenciais;
* ausência de artefatos;
* ausência de arquivos temporários.

---

## T002-74 — Executar suíte final

Executar todos os testes automatizados novamente.

---

## T002-75 — Commit da Fase 03

Commit somente após:

* todos os ACs comprovados;
* E2E aprovado;
* teste Windows aprovado;
* revisão de segurança aprovada;
* README atualizado.

Mensagem sugerida:

```text
feat(windows-agent): implement device heartbeat agent
```

---

# Definition of Done — SPEC-002

A Fase 03 somente pode ser considerada concluída quando:

* [ ] Windows Agent executa como serviço.
* [ ] Serviço inicia automaticamente.
* [ ] Configuração é externa ao `.exe`.
* [ ] Heartbeat é enviado conforme SPEC-001.
* [ ] Autenticação usa `DeviceKey`.
* [ ] Telemetria contém somente campos permitidos.
* [ ] `communication_status` não existe no Agent.
* [ ] Retry transitório possui exponential backoff + jitter.
* [ ] 401/422/4xx/3xx não utilizam backoff.
* [ ] Recuperação retorna ao intervalo normal.
* [ ] Não existe store-and-forward.
* [ ] Secret nunca aparece nos logs.
* [ ] Logs possuem rotação.
* [ ] Falha do logging não derruba o Agent.
* [ ] Serviço possui recovery policy.
* [ ] Build reproduzível foi validado.
* [ ] `.exe` não contém credenciais.
* [ ] E2E contra backend foi aprovado.
* [ ] Testes automatizados estão verdes.
* [ ] Teste manual Windows foi aprovado.
* [ ] AC-01 a AC-13 possuem evidência.
* [ ] README atualizado.
* [ ] QA final aprovado.
* [ ] Commit realizado.

---

# Gates de QA

## GATE 1 — Spike

Bloqueia toda a implementação caso:

* PyInstaller `onefile` não funcione;
* Windows Service não funcione;
* instalação/start/stop falhem;
* incompatibilidade Python/pywin32 seja crítica.

## GATE 2 — Contract

Bloqueia integração caso:

* payload diverja da SPEC-001;
* `communication_status` apareça;
* autenticação diverja do ADR-006;
* backend precise ser alterado para acomodar o Agent.

## GATE 3 — Security

Bloqueia release caso:

* secret apareça em log;
* secret esteja no código;
* secret esteja no `.exe`;
* configuração real esteja versionada;
* redirect possa reenviar credencial indevidamente.

## GATE 4 — E2E

Bloqueia conclusão caso:

* heartbeat não seja persistido;
* Agent não se recupere após indisponibilidade;
* serviço não reinicie corretamente;
* histórico existente seja alterado.

## GATE 5 — Final QA

Somente após todos os gates:

```text
SPECIFY
   ↓
PLAN
   ↓
TASKS  ← atual
   ↓
IMPLEMENT
   ↓
TEST
   ↓
REVIEW
   ↓
COMMIT
   ↓
DOCUMENT
   ↓
NEXT SPEC
```
