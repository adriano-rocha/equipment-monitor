# PLAN-002 — Windows Agent

Spec: `specs/002-windows-agent/spec.md`. Contrato consumido: SPEC-001 (sem alterações).
Status: rascunho revisado para QA (revisão corretiva). Nenhuma mudança no backend da Fase 02 é proposta.
Nenhuma alteração na SPEC-002 é aplicada por este plano: os alinhamentos necessários estão listados na seção 14, aguardando o QA.

## 1. Resumo das decisões

| Ponto em aberto | Decisão | Seção |
|---|---|---|
| Classificação de erros / backoff | 3 classes: SUCCESS, TRANSIENT (backoff), REJECTED (intervalo normal) | 3 |
| "Não bloqueia o ciclo normal" | Uma tentativa por ciclo, sem retry interno, esperas sempre interrompíveis | 2 |
| Serviço Windows | pywin32 `ServiceFramework`, parada por `threading.Event`, parada best-effort | 4 |
| `.exe` único | PyInstaller `--onefile` é a opção principal; spike valida; AC-12 inalterado | 5 |
| Config | TOML, lido só na inicialização, fora do repositório e do build | 6 |
| Logs | `RotatingFileHandler` 5 MiB × 5, redação de segredo, fallback no Event Log | 7 |
| Telemetria | Só stdlib (`socket`, `ctypes`) | 8 |
| Cliente HTTP | Só stdlib (`urllib`); única dependência de runtime: `pywin32` | 9 |

## 2. Modelo de execução: uma tentativa por ciclo

Cada ciclo faz 1 coleta de telemetria e 1 tentativa HTTP. **Não existe laço de retry
interno.** "Retry" é apenas a próxima iteração, com espera calculada pelo resultado:

```
falhas_transitorias = 0
enquanto não parar:
    payload = telemetria.coletar()        # nunca lança; campo indisponível é omitido
    resultado = sender.enviar(payload)    # 1 tentativa; nunca lança; mapeia erro -> resultado
    SUCCESS   -> falhas_transitorias = 0;   espera = intervalo
    REJECTED  -> falhas_transitorias = 0;   espera = intervalo
    TRANSIENT -> falhas_transitorias += 1;  espera = backoff(falhas_transitorias)
    registrar log conforme seção 3
    se stop_event.wait(espera): sair
```

Semântica do contador `falhas_transitorias` (única fonte de verdade):

| Resultado | Contador | Próxima espera |
|---|---|---|
| SUCCESS | zera | `intervalo` |
| REJECTED (401, 422, outros 4xx, 3xx) | zera | `intervalo` |
| TRANSIENT (timeout, conexão, DNS, TLS, 5xx, 408, 429) | incrementa e mantém entre falhas consecutivas | `backoff(n)` |
| Exceção inesperada no ciclo, tratada como transitória | incrementa e mantém | `backoff(n)` |

Só SUCCESS e REJECTED zeram o contador. Uma resposta HTTP **não** zera o contador por si só:
5xx, 408 e 429 são respostas HTTP, mas são TRANSIENT e o incrementam. REJECTED zera porque não
é falha transitória: o backend respondeu de forma determinística.

`backoff(n)`: base = min(30 s, 2^(n-1) s) → 1, 2, 4, 8, 16, 30, 30… O jitter é "equal jitter":
a espera fica em `[base/2, base]`. Constantes no código (YAGNI).

O que "não bloqueia o próximo ciclo normal" significa na prática:

1. **Sem laço de retry interno**: o retry é a próxima iteração e nada fica preso.
2. **Cada operação de rede tem timeout de socket de 10 s** (conexão e leitura). Não existe limite
   total garantido para uma requisição: a resolução DNS e as múltiplas operações não são
   cobertas por um único prazo (ver R7).
3. **Toda espera (intervalo ou backoff) usa `stop_event.wait(t)`** e é interrompida
   imediatamente pelo sinal de parada.
4. **Uma requisição já iniciada não é cancelada**: pode precisar aguardar a conclusão ou o
   timeout da operação de rede. A parada é best-effort (seção 4).
5. **A espera após falha nunca passa de 30 s**, por mais longa que seja a queda.
6. **A recuperação é imediata**: o primeiro SUCCESS zera o contador e a espera seguinte é
   `intervalo`. O histórico de falhas não afeta o ciclo normal.
7. **Sem reenvio e sem compensação de ciclos perdidos**: cada tentativa coleta telemetria nova
   (coerente com "sem store-and-forward").
8. O intervalo é contado do fim da tentativa (sem agenda fixa). Se `intervalo` for menor que o
   teto do backoff (ex.: 10 s), o backoff reduz a cadência de propósito durante a queda, para
   proteger o backend.

Exceção inesperada no ciclo (bug): é capturada (`Exception`, nunca `BaseException`), registrada
com traceback (já redigido) e tratada como TRANSIENT. **O laço nunca morre.**

## 3. Classificação de erros

| Situação | Classe | Backoff? | Próxima espera | Log |
|---|---|---|---|---|
| 2xx (esperado: 201) | SUCCESS | contador zera | `intervalo` | DEBUG; INFO na volta após falhas |
| Timeout, conexão recusada, DNS, falha TLS | TRANSIENT | **sim** (incrementa) | `backoff(n)` | WARNING |
| 5xx, 408, 429 | TRANSIENT | **sim** (incrementa) | `backoff(n)` | WARNING (com status) |
| 401 | REJECTED | **não** (contador zera) | `intervalo` | ERROR ("credenciais rejeitadas"; sem key_id/secret) |
| 422 | REJECTED | **não** (contador zera) | `intervalo` | ERROR + corpo da resposta truncado em 1000 chars |
| Outros 4xx e 3xx | REJECTED | **não** (contador zera) | `intervalo` | ERROR com status (redirect não é seguido) |
| Exceção inesperada | TRANSIENT | **sim** (incrementa) | `backoff(n)` | ERROR com traceback |

Justificativa:
- O backoff protege o backend contra tempestade de retries e acelera a detecção de retorno. Só
  faz sentido para falha **transitória**.
- Um 4xx é determinístico: repetir mais rápido não ajuda. Repetir no intervalo normal atende o
  AC-07 ("continua no próximo ciclo") sem sobrecarregar o backend.
- A config é lida só na inicialização (seção 6): um 401 por credencial errada só se resolve
  editando o arquivo e reiniciando o serviço, ou com correção feita no backend.
- Redirect (3xx) não é seguido. Assim o header `Authorization` não é reenviado a outro host e o
  erro fica visível ("verifique se `backend_url` usa https").

Log de falhas repetidas (evita inundar o log e empurrar histórico útil para fora da rotação). Usa
um contador próprio, `repeticoes_no_mesmo_estado`, **independente** de `falhas_transitorias`:
- A 1ª ocorrência de um estado de falha loga em WARNING/ERROR.
- Repetições idênticas logam em DEBUG, com lembrete em WARNING/ERROR a cada 20 repetições
  consecutivas do mesmo estado, com contador.
- A volta ao SUCCESS loga INFO: "comunicação restabelecida após N falhas".
- Linguagem neutra ("falha ao enviar heartbeat", "sem conexão com o backend"), nunca sugerindo
  "roubado" (REGRA 11).

## 4. Serviço Windows

**Biblioteca**: `pywin32` (`win32serviceutil.ServiceFramework`, `servicemanager`).
- Alternativas descartadas: NSSM e WinSW exigem um binário externo a distribuir e auditar.
  ctypes puro reimplementaria o protocolo do SCM.

| Item | Decisão |
|---|---|
| Nome / exibição | `EquipmentMonitorAgent` / "Equipment Monitor Agent" |
| Comandos | do próprio `.exe`, via `HandleCommandLine`: `install`, `update`, `remove`, `start`, `stop`, `restart`, `debug` (execução em console, sem instalar) |
| Início | `--startup auto` (não *delayed*): encurta o intervalo sem comunicação após o boot. Rede ainda não pronta é absorvida pelo backoff |
| Conta | `LocalService` (menor privilégio) recomendada; `LocalSystem` como fallback documentado (15-G) |
| Pause/Continue | não suportado (só Stop e Shutdown) |
| Credencial | **nunca em argumentos do serviço** (visíveis via `sc qc`/lista de processos); só por arquivo |

Ciclo de vida:

| Evento | Comportamento |
|---|---|
| `SvcDoRun` (start) | Reporta START_PENDING → inicia logging → carrega config. Config inválida: log de erro e Event Log, para o serviço sem enviar nada (AC-01). Config válida: reporta RUNNING e roda o laço da seção 2 na thread principal do serviço |
| `SvcStop` | Reporta STOP_PENDING (wait hint definido na implementação, sem garantia de duração) e faz `stop_event.set()` |
| `SvcShutdown` (desligamento do SO) | Mesmo procedimento do Stop. Confirmar na implementação que `SERVICE_ACCEPT_SHUTDOWN` está habilitado |
| Reboot | Início automático; o backoff cobre a rede ainda indisponível |
| Suspensão/hibernação | As esperas retomam ao acordar; o 1º heartbeat pode atrasar até o restante do intervalo. Rede ausente vira TRANSIENT e o backoff recupera. O backend decide o status (REGRA 09) |
| Crash | Recovery policy do SCM: reiniciar após 5 s / 5 s / 60 s, reset em 1 dia (`sc failure`, no procedimento de instalação). Validar a interação com o stop por config inválida: não deve virar loop de restarts |

**Parada (Stop/Shutdown) é best-effort:**
- Esperas e backoff são interrompidos imediatamente pelo `stop_event`.
- Uma requisição já iniciada pode precisar aguardar a conclusão ou o timeout da operação de
  rede. **Não há garantia de tempo máximo de parada.**
- O SCM/SO pode encerrar o processo à força se o serviço demorar. Isso é inofensivo: **não existe
  estado local a persistir** (sem fila, sem banco local; o log faz flush por registro). O backend
  já garante atomicidade (SPEC-001).
- O Agent **nunca envia heartbeat de "offline"** ao parar (REGRA 10).

Entrada: no `.exe` congelado, sem argumentos, usa o padrão
`Initialize → PrepareToHostSingle → StartServiceCtrlDispatcher`. Com argumentos, chama
`HandleCommandLine`. Só `interface/service.py` importa `win32*`.

## 5. Empacotamento (`.exe` único)

- **PyInstaller `--onefile` é a opção principal** e atende o AC-12 como escrito. Alternativas
  avaliadas: Nuitka (build mais pesado, precisa de compilador C), cx_Freeze/py2exe (menos comuns
  com pywin32).
- **Spike obrigatório antes do resto** (primeira etapa): serviço mínimo (só loga e espera)
  empacotado com `--onefile`, com install/start/stop/remove e reinício da máquina. Critérios:
  1. o serviço inicia (sem erro 1053);
  2. para de forma limpa;
  3. não acumula pastas `_MEI*` em `Temp` após 5 reboots (onefile extrai para o Temp da conta de
     serviço a cada start; encerramento forçado pode deixar resíduo);
  4. o Windows Defender não bloqueia.
- **Se o spike reprovar o `onefile`**: a decisão de aceitar `onedir` (pasta única distribuída como
  .zip, sem extração em runtime) **será submetida ao QA antes de qualquer alteração na
  SPEC-002**. Este plano não altera o AC-12 e não pressupõe que ele será alterado.
- Estrutura influenciada: `interface/service.py` é o único ponto de entrada congelado. O `.spec`
  ou `scripts/build.ps1` fica em `windows-agent/` e a saída em `dist/` (fora do git).
- Python `>=3.12` (usa `tomllib`). Confirmar no spike o suporte de PyInstaller e pywin32 ao 3.13
  (a máquina de dev usa 3.13.5); senão fixar 3.12 via `uv`.
- `.exe` não assinado (assinatura de código fora de escopo; ver R3).

## 6. Configuração e proteção do segredo

Formato **TOML** (`tomllib` da stdlib, sem dependência, comentários permitidos, tipos nativos).

- Caminho: `%PROGRAMDATA%\EquipmentMonitor\agent.toml`. Override para dev/teste pela variável de
  ambiente `EQUIPMENT_MONITOR_AGENT_CONFIG`.
- Leitura **só na inicialização**: alterar o intervalo exige `restart` do serviço, sem recompilar
  (AC-13). Sem hot-reload, para não ter estado parcial de credencial ou URL.

| Chave | Obrig. | Regra |
|---|---|---|
| `key_id` | sim | não vazio, sem `:`, espaços ou caracteres de controle |
| `secret` | sim | não vazio, sem caracteres de controle ou quebra de linha (evita injeção de header) |
| `backend_url` | sim | `https://…` (ou `http://` conforme `allow_insecure_http`, abaixo), com host, sem credenciais, query ou fragment |
| `heartbeat_interval_seconds` | não (30) | inteiro entre 5 e 300 (guarda técnica de sanidade, não é regra de negócio) |
| `log_level` | não (INFO) | DEBUG/INFO/WARNING/ERROR |
| `allow_insecure_http` | não (`false`) | ver abaixo |

**`allow_insecure_http`** (opção não prevista na SPEC-002 original; mantida somente pela
justificativa técnica abaixo, e pendente de decisão do QA, 15-E):
- Justificativa: a validação manual (E2E) contra o backend do `docker-compose` (HTTP em
  `localhost:8000`) e os testes de integração com servidor HTTP local exigiriam, sem ela,
  provisionar TLS local, fora do escopo desta fase.
- Regras: o padrão é `false` e **HTTPS é obrigatório em produção**. `http://` só é aceito com
  opt-in explícito (`true`) **e** apenas para host loopback (`localhost`, `127.0.0.1`, `::1`).
  Qualquer outro host com `http://` é config inválida, mesmo com a opção ligada.
- Gera **WARNING a cada start** quando ativa.
- O README documenta: **não usar com credenciais reais em produção**.
- A validação TLS de `https://` fica sempre ligada e **nunca** pode ser desabilitada.
- Alternativa: se o QA considerar a opção complexidade desnecessária, ela é removida e HTTPS
  passa a ser sempre exigido (os testes de integração usariam um parâmetro interno do sender e o
  E2E exigiria HTTPS local).

Regras adicionais:
- O loader rejeita valores placeholder do `config.example.toml` (ex.: `REPLACE_ME`).
- Chave desconhecida gera WARNING, não erro.
- Mensagens de erro citam só o **nome** do campo, nunca o valor.

Proteção do segredo no build e na publicação:
1. O `.exe` **não contém** credencial nem config: nenhum arquivo de config é empacotado.
2. O `config.example.toml` só tem placeholders. Um teste automático garante isso.
3. `.gitignore`: `windows-agent/**/agent.toml`, `windows-agent/dist/`, `windows-agent/build/`, `*.log`.
   A config real vive fora do repositório (ProgramData).
4. O build não recebe nenhum segredo (nenhuma variável de ambiente necessária). Os artefatos de
   build não são versionados.
5. `AgentConfig.secret` com `repr=False`, mais o filtro de redação de log (seção 7).
6. Segredo nunca em argv, nome de arquivo ou URL.
7. Em disco o segredo fica em **texto puro** (decisão do QA). Mitigação: ACL restrita
   (`icacls … /inheritance:r`, com a sintaxe a validar na implementação) documentada no README.
   Cifragem (DPAPI) fica para spec futura.

## 7. Logs

| Item | Decisão |
|---|---|
| Arquivo | `%PROGRAMDATA%\EquipmentMonitor\logs\agent.log` |
| Rotação | `RotatingFileHandler`, 5 MiB por arquivo, 5 backups (**≤ 30 MiB** no total) |
| Retenção | Por tamanho, não por tempo. Em INFO (só transições) dura meses. Em DEBUG (~375 KB/dia) ~80 dias |
| Formato | `timestamp UTC ISO-8601 · nível · logger · mensagem`, UTF-8 |
| Nível | INFO por padrão; `log_level` na config |
| Redação | Filtro no handler que mascara `secret` e `key_id` (AC-07 e AC-11), inclusive em `exc_text`. O `debuglevel` do `http.client` nunca é habilitado |
| Ordem de init | Logging mínimo (INFO) → carrega config → aplica `log_level` |
| `debug` + serviço | Não rodar `debug` com o serviço ativo (dois processos rotacionando o mesmo arquivo falham no Windows). Documentado |

**Log não gravável** (permissão, disco cheio, pasta ausente), pendente de decisão do QA (15-H):
1. Na inicialização: uma entrada no **Windows Event Log** (`servicemanager.LogErrorMsg`) e o
   agente **segue enviando heartbeats sem log em arquivo**. A função de monitoramento vale mais
   que o diagnóstico.
2. Em runtime: um `handleError` customizado registra no máximo 1 entrada no Event Log por hora e
   **nunca propaga a exceção** ao laço (`logging.raiseExceptions = False`).
3. Config inválida ou falha fatal de start também vão ao Event Log, porque o arquivo pode ser
   justamente o que falhou.

## 8. Telemetria (stdlib apenas)

| Campo | Fonte | Omitido quando |
|---|---|---|
| `hostname` | `socket.gethostname()` (truncado em 255, ver 16) | erro ou vazio |
| `battery_level` | `kernel32.GetSystemPowerStatus` via `ctypes`: `BatteryLifePercent`, com clamp 0–100 | `BatteryFlag == 128` (sem bateria) ou `BatteryLifePercent == 255` (desconhecido) |
| `reported_ip` | IP local da rota de saída: socket UDP `connect()` a `192.0.2.1` (TEST-NET-1, **nenhum pacote é enviado**), lido com `getsockname()` e validado com `ipaddress` | sem rota, ou loopback, link-local ou não especificado |

- Cada coletor é isolado: falha em um campo omite só aquele campo e nunca aborta o ciclo. As
  chamadas de SO ficam atrás de funções injetáveis (testáveis sem Windows).
- `device_timestamp` **não é enviado** (resolve o "a confirmar" da spec §8).
- `reported_ip` é telemetria não confiável (ADR-008). Com VPN, a interface escolhida pode
  diferir; aceito.
- `psutil` foi descartado: o único uso seria a bateria (~20 linhas de `ctypes`).
- O Agent envia somente `hostname`, `battery_level` e `reported_ip`. Não coleta nem calcula
  nenhum campo de status (REGRA 09 e 10).

## 9. Cliente HTTP

- `urllib.request` (stdlib) com `opener` sem seguir redirect. `POST {backend_url}/api/v1/heartbeats`.
- Headers: `Authorization: DeviceKey <key_id>:<secret>`, `Content-Type: application/json`,
  `User-Agent: EquipmentMonitorAgent/<versão>` (informativo; não faz parte do contrato da
  SPEC-001).
- Corpo: JSON com só os campos presentes (`{}` é válido).
- Timeout de 10 s **por operação** de rede (conexão e leitura). Não é um limite total (seção 2).
- Verificação TLS com o `ssl` padrão do Python, sempre ligada em `https://`.
- Por que stdlib em vez de `httpx`: o `ssl` do Python no Windows confia no **repositório de
  certificados do sistema** (CAs corporativas). O `httpx` usa o bundle `certifi` por padrão e
  falharia com proxy de inspeção TLS ou CA interna. Também reduz dependências e o tamanho do
  `.exe`.
- O corpo da resposta só é lido em 422 e outros 4xx (para log), **truncado em 1000 chars**.

## 10. Estrutura e dependências

```
windows-agent/
  pyproject.toml  uv.lock  config.example.toml  README.md
  scripts/build.ps1
  agent/
    domain/          payload.py  backoff.py  outcome.py
    application/     ports.py  runner.py
    infrastructure/  config.py  telemetry.py  http_sender.py  logging_setup.py
    interface/       service.py            # único módulo que importa win32*
  tests/
    unit/  integration/
```

Camadas pragmáticas, como no backend. O `HeartbeatRunner` recebe os ports (`Telemetry`,
`Sender`) e o `stop_event` por injeção. É isso que permite testar backoff e classificação sem
rede, sem Windows e sem `sleep` real.

| Dependência | Tipo | Motivo |
|---|---|---|
| `pywin32` (marker `sys_platform == 'win32'`) | runtime | Serviço Windows e Event Log. Não há alternativa nativa |
| `pyinstaller` | build | `.exe` |
| `pytest` | dev | testes |
| stdlib: `tomllib`, `logging`, `socket`, `ctypes`, `urllib`, `threading`, `random`, `ipaddress`, `json` | — | sem custo extra |

## 11. Estratégia de testes

| AC | Como é comprovado |
|---|---|
| 01 | Unit: config ausente, inválida, placeholder, intervalo fora da faixa, `http://` sem opt-in ou fora de loopback. Manual: serviço com config inválida loga e para |
| 02 | Integration com `ThreadingHTTPServer` local: método, path e header exatos |
| 03, 09 | Contract: chaves do payload ⊆ {hostname, battery_level, reported_ip}; nenhum campo de status |
| 04 | Unit da telemetria com função de SO simulada: sem bateria, 255, exceção |
| 05, 06 | Unit do runner com fake sender: sequência de esperas, teto de 30 s e laço vivo após 100 falhas; contador conforme a tabela da seção 2 (TRANSIENT incrementa e mantém; SUCCESS e REJECTED zeram; sequência mista); `stop_event` interrompe a espera. Integration: 500, timeout, conexão recusada |
| 07, 08 | Unit e integration: 401/422/4xx/3xx usam `intervalo`, sem backoff, com log truncado em 1000 chars e sem segredo |
| 10 | Propriedade do backend (testes da SPEC-001). Manual: parar e voltar o backend e conferir que os heartbeats antigos seguem no banco |
| 11 | Roda ciclos em DEBUG (sucesso, falha, exceção) e afirma que `secret` e `key_id` não aparecem em nenhum log |
| 12, 13 | Manual, com checklist: build, install, start, reboot, stop, `restart` após editar o intervalo, cadência conferida nos `received_at` do banco. O checklist inclui o resultado do spike |

E2E manual contra o backend real (`docker compose` + `seed_device.py`) documentado no README.

## 12. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | `--onefile` + serviço pywin32 pode falhar (erro 1053) | Spike com gate. Se reprovar, decisão do QA antes de qualquer alteração na SPEC-002 |
| R2 | Resíduo `_MEI*` no Temp após encerramento forçado | Critério do spike. Mesmo tratamento de R1 |
| R3 | `.exe` não assinado pode ser bloqueado por antivírus/SmartScreen (inclusive a stack de segurança Dell) | Testar no spike. Assinatura fica para spec futura |
| R4 | Segredo em texto puro no disco | ACL restrita, conta de serviço mínima, cifragem em spec futura |
| R5 | Compatibilidade PyInstaller/pywin32 com Python 3.13 | Verificar no spike. Fixar 3.12 se preciso |
| R6 | Encerramento forçado no stop/shutdown | Agente sem estado local a persistir; backend atômico; parada best-effort |
| R7 | Resolução DNS e requisição em andamento podem demorar além do timeout de socket, sem limite total de tempo | Aceito. Afeta só a latência da parada, que é best-effort (seção 4) |
| R8 | Frota sincronizada (todos ligam juntos) gera picos no backend | Aceito nesta fase. Considerar jitter no 1º ciclo em spec futura |
| R9 | Coerência entre o intervalo do agente e o critério de comunicação do backend | **Dependência a confirmar** contra `specs/001-device-heartbeat/spec.md` e o código do backend (seção 16). Não é regra do Agent, que não conhece nem calcula `communication_status` |
| R10 | Deriva de contrato com o backend | Contract test do payload + E2E manual |

## 13. Sequência sugerida (insumo para `tasks.md`; ainda não criado)

0. Spike de empacotamento e serviço (gate). 1. Esqueleto `uv` + estrutura. 2. Domínio (payload,
backoff, outcome) + testes. 3. Config + testes. 4. Telemetria + testes. 5. HTTP sender + testes com
servidor local. 6. Runner + testes. 7. Logging e redação + testes. 8. `service.py`. 9. Build
`.exe`. 10. E2E e checklist manual. 11. README, `PROJECT-CONTEXT.md`, commit.

## 14. Alinhamentos propostos na SPEC-002 (NÃO aplicados; dependem de aprovação do QA)

1. §5: a frase "não bloqueia o próximo ciclo normal … ver seção 8" é ambígua e aponta para a seção
   errada (o backoff é §9). Reescrever conforme o modelo da seção 2 deste plano.
2. AC-07 e AC-08: explicitar que 401, 422 e outros 4xx **não** entram no backoff e esperam o
   intervalo normal.
3. **AC-08 deverá ser ajustado para permitir o registro do corpo da resposta até o limite máximo
   definido pelo PLAN** (hoje a spec fala em registrar a resposta completa; o PLAN limita a 1000
   caracteres por segurança e robustez).
4. §6: adicionar a chave opcional `log_level`. A chave `allow_insecure_http` só entra se o QA
   mantiver a opção (15-E).
5. §8: remover o "a confirmar" sobre `device_timestamp` (decidido: não é enviado).
6. **AC-12 permanece inalterado.**

## 15. Decisões pendentes de aprovação do QA

| ID | Decisão | Recomendação |
|---|---|---|
| A | Spike com gate. `onefile` é a opção principal. Se reprovar, a aceitação de `onedir` é decidida pelo QA antes de qualquer mudança na SPEC-002 | Aprovar |
| B | HTTP e telemetria só com stdlib; único runtime é `pywin32` | Aprovar |
| C | Config lida só no start (mudança exige restart) | Aprovar |
| D | 401/422/outros 4xx/3xx são REJECTED: sem backoff, espera `intervalo`. Contador: SUCCESS e REJECTED zeram; TRANSIENT incrementa e mantém | Aprovar |
| E | `allow_insecure_http`: manter (padrão `false`, opt-in, só loopback, WARNING) ou remover e exigir HTTPS sempre | Manter com as restrições da seção 6 |
| F | Intervalo entre 5 e 300 s como guarda técnica de sanidade | Aprovar |
| G | Conta do serviço: `LocalService` (fallback `LocalSystem`) | `LocalService`, validar no teste manual |
| H | Log não gravável: seguir enviando heartbeats, com aviso único no Event Log | Aprovar |
| I | Sem ADR novo (decisões de implementação, só neste plano). ADR-009 só se o QA preferir | Aprovar |
| J | Alinhamentos da SPEC-002 da seção 14 | Aprovar antes do `tasks.md` |

## 16. Dependências a confirmar contra a SPEC-001 e o backend

O Agent não decide nem calcula `communication_status` (REGRA 09 e 10). Os pontos abaixo dependem
da confirmação em `specs/001-device-heartbeat/spec.md` e no código do backend:
1. Relação entre o intervalo de heartbeat do agente e o critério de comunicação do backend (R9).
2. Códigos HTTP do contrato (201 sucesso, 401 credencial, 422 payload) usados na classificação da
   seção 3.
3. Validação de formato de `reported_ip` (o schema atual aceita string livre, coluna de 45
   chars) e limites de tamanho de `hostname` (255) e `reported_ip` (45), presumidos a partir do
   schema e do banco. O Agent já envia somente IP validado e hostname truncado.