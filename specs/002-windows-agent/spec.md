# SPEC-002 — Windows Agent

## 1. Objetivo

Especificar um agente (Windows Agent) que executa nos notebooks Dell/Windows
alugados para eventos, coleta telemetria básica do equipamento e envia
heartbeats periódicos para o backend, usando o contrato já definido e
implementado na SPEC-001 (Device Heartbeat), sem alterá-lo.

O Agent é um componente de borda: sua única responsabilidade é **tentar
comunicar** com o backend em intervalos regulares. Toda decisão sobre o
estado de comunicação do dispositivo (`ONLINE` / `SEM_COMUNICACAO`) é do
backend — nunca do Agent (REGRA 09, REGRA 10).

## 2. Contexto e motivação

A Fase 02 entregou o endpoint `POST /api/v1/heartbeats`, autenticado via
header `Authorization: DeviceKey <key_id>:<secret>` (ADR-006), testado e em
produção. Não existe hoje nenhum processo automatizado que envie heartbeats
para esse endpoint — o único teste é manual, via `curl`/Postman, usando
credenciais geradas por `scripts/seed_device.py`.

Esta spec cobre a construção do processo que roda de fato no notebook do
cliente e mantém esse envio acontecendo de forma contínua e resiliente.

## 3. Escopo desta fase

- Leitura de configuração local (credencial de dispositivo, URL do backend,
  intervalo de heartbeat).
- Coleta de telemetria local restrita ao contrato já existente da SPEC-001:
  `hostname`, `battery_level`, `reported_ip`.
- Envio periódico de `POST /api/v1/heartbeats`, autenticado.
- Retry com exponential backoff em caso de falha de comunicação.
- Logging local, sem exposição de credenciais.
- Empacotamento como executável único (`.exe`) e execução como Windows
  Service, com início automático com o sistema operacional.

## 4. Fora de escopo (fica para fases/specs futuras)

- Instalador MSI / Setup Wizard sofisticado — instalação nesta fase é manual
  (copiar o `.exe` + arquivo de configuração + registrar o serviço).
- Portal de onboarding, QR Code, API de provisionamento, instalação remota
  ou qualquer gerenciamento automatizado de credenciais — provisionamento
  continua manual, via `scripts/seed_device.py` existente.
- Cálculo ou declaração de `communication_status` pelo Agent, em qualquer
  forma (REGRA 09, REGRA 10).
- Coleta de número de série, Dell Service Tag, modelo, CPU, RAM, disco,
  BIOS ou qualquer inventário de hardware detalhado — isso é uma evolução de
  contrato (SPEC-001 ou uma spec própria de inventário), não desta spec.
- Fila persistente, banco local (SQLite ou outro), store-and-forward, ou
  qualquer histórico de heartbeats mantido pelo próprio Agent.
- Qualquer alteração no contrato da SPEC-001 ou no backend da Fase 02.

## 5. Fluxo funcional

Início do serviço
- Lê arquivo de configuração local (credencial, backend_url, intervalo)
- Falha de configuração (campo obrigatório ausente/inválido)?
- Registra erro em log, encerra o serviço (não tenta enviar sem credencial)
- Loop principal (a cada heartbeat_interval_seconds):
- Coleta telemetria local (hostname, battery_level, reported_ip)
- Monta payload conforme contrato da SPEC-001
- POST /api/v1/heartbeats com header Authorization: DeviceKey <key_id>:<secret>
- Sucesso (201)?
- Registra sucesso em log (nível debug/info)
- Aguarda o próximo ciclo no intervalo configurado
> Falha (timeout, erro de rede, 5xx, 401, 422)?
- Registra erro em log (sem credenciais)
- Aplica exponential backoff (não bloqueia o próximo ciclo normal
indefinidamente — ver seção 8)
- Continua tentando; nunca desiste, nunca encerra o serviço


## 6. Configuração local

O Agent lê, na inicialização, um arquivo de configuração local (formato a
definir em `plan.md`) contendo, no mínimo:

| Campo | Obrigatório | Descrição |
|---|---|---|
| `key_id` | Sim | Identificador público da credencial (ADR-006). |
| `secret` | Sim | Segredo da credencial, em texto puro. |
| `backend_url` | Sim | URL base do backend (ex.: `https://api.exemplo.com`). |
| `heartbeat_interval_seconds` | Não (padrão: 30) | Intervalo entre heartbeats, configurável sem recompilar o `.exe`. |

Regras:
- O arquivo de configuração **nunca** é commitado no repositório (mesmo
  tratamento de `.env` — REGRA 13-14).
- `secret` nunca é hardcoded no código-fonte, em nenhuma circunstância.
- `secret` nunca aparece em nenhuma linha de log, em nenhum nível de
  verbosidade (AC-11).
- Alterar `heartbeat_interval_seconds` no arquivo não exige recompilar o
  `.exe` — o mecanismo exato de recarregamento (por ciclo vs. exigindo
  reinício do serviço) é decidido em `plan.md`.

## 7. Autenticação

O Agent **usa** a credencial provisionada (`key_id` + `secret`) para montar o
header `Authorization: DeviceKey <key_id>:<secret>`, exatamente como definido
no ADR-006 e implementado na SPEC-001.

**Importante (REGRA 15):** o Agent **não hasheia nem valida** o `secret` — ele
apenas o transporta na requisição. A verificação criptográfica (hash argon2,
comparação, status `ACTIVE`/`REVOKED`) é responsabilidade **exclusiva** do
backend (`DeviceAuthService`, já implementado). O Agent não tem, e não deve
ter, nenhuma lógica de verificação de senha.

## 8. Heartbeat — payload e intervalo

- Intervalo padrão: **30 segundos**, configurável (seção 6).
- Payload enviado contém **somente** os campos já previstos no contrato da
  SPEC-001: `hostname`, `battery_level`, `reported_ip`. Nenhum campo novo é
  adicionado nesta fase (seção 4).
- `battery_level` é omitido (não enviado, nunca com valor inventado) quando
  o equipamento não possui bateria ou a leitura falhar.
- `reported_ip` é telemetria informativa (ADR-008) — o Agent não precisa se
  preocupar em determinar seu IP "correto"; o backend usa `source_ip`
  (observado na conexão) como fonte autoritativa.
- O Agent não envia `device_timestamp` nesta fase (campo opcional do
  contrato) — a confirmar se isso muda em `plan.md`, sem necessidade.
- O Agent **nunca** envia, calcula ou infere `communication_status` (REGRA
  09, REGRA 10) — esse campo simplesmente não existe do lado do Agent.

## 9. Retry / Backoff

- Estratégia: exponential backoff simples com jitter, limite máximo de
  aproximadamente 30 segundos entre tentativas (ex. conceitual: 1s → 2s → 4s
  → 8s → 16s → ~30s).
- Após atingir o limite máximo, o Agent continua tentando indefinidamente
  nesse intervalo máximo, até a comunicação ser restabelecida — nunca
  desiste definitivamente, nunca encerra o serviço por falha de comunicação.
- Assim que uma tentativa tem sucesso, o Agent retorna ao ciclo normal
  (intervalo configurado, seção 6) — o backoff não "vaza" para os ciclos
  seguintes bem-sucedidos.
- Não há fila persistente nem store-and-forward (seção 4) — heartbeats não
  enviados durante uma falha de comunicação são simplesmente perdidos (não
  existe tentativa de reenviar heartbeats "atrasados" com timestamps
  passados).

**Relação com REGRA 07 (histórico de heartbeats nunca sobrescrito):**
- O **backend** preserva o histórico de heartbeats já recebidos — isso não
  muda e não é afetado por esta spec.
- O **Agent** não mantém histórico persistente/store-and-forward nesta fase
  — não há conflito entre as duas afirmações: são responsabilidades de
  componentes diferentes.
- Uma falha de comunicação do Agent não apaga, sobrescreve ou de qualquer
  forma altera o histórico já persistido no backend — ela apenas significa
  que nenhum heartbeat novo foi registrado durante aquele período.

## 10. Logging

- Logs locais (arquivo, rotacionado — detalhe de implementação em
  `plan.md`), com níveis adequados (info para sucesso, warning/error para
  falhas de comunicação, error para falha de configuração).
- **Nunca** registrar `secret` em nenhuma linha de log.
- Mensagens de erro relacionadas a falha de comunicação usam linguagem
  neutra ("falha ao enviar heartbeat", "sem conexão com o backend") — nunca
  qualquer termo que sugira ou implique "roubado" ou equivalente (REGRA 11),
  mesmo que indiretamente via mensagem de log.

## 11. Empacotamento e execução como serviço

- O Agent é distribuído como um executável único (`.exe`).
- Deve ser possível registrar esse executável como um Windows Service,
  configurado para iniciar automaticamente com o sistema operacional e
  executar em background (sem janela de console visível ao usuário).
- Não é necessário, nesta fase, um instalador MSI ou Setup Wizard —
  instalação e registro do serviço podem ser manuais/scriptados via
  linha de comando.
- Ferramenta/biblioteca específica de empacotamento e de implementação do
  serviço Windows é decisão de `plan.md`, não desta spec.

## 12. Regras de negócio aplicadas (referência)

| Regra | Aplicação nesta spec |
|---|---|
| REGRA 09 | Backend decide comunicação; Agent nunca calcula status. |
| REGRA 10 | Agent nunca se autodeclara offline, em nenhuma forma. |
| REGRA 11 | Linguagem de log nunca sugere "roubado" para falha de comunicação. |
| REGRA 13-14 | `secret` nunca em código; via arquivo de configuração local, fora do controle de versão. |
| REGRA 15 | Agent não hasheia nem valida `secret` — apenas o transporta; validação é exclusiva do backend. |
| REGRA 07 | Backend preserva histórico; Agent não mantém histórico próprio; falha do Agent não altera o histórico do backend. |

## 13. Critérios de aceitação

- **AC-01**: O Agent lê `key_id`, `secret`, `backend_url` e
  `heartbeat_interval_seconds` de um arquivo de configuração local; se algum
  campo obrigatório estiver ausente ou inválido, registra o erro em log e
  não envia heartbeat sem credencial válida.
- **AC-02**: A cada intervalo configurado, o Agent envia `POST` para o
  endpoint de heartbeat da SPEC-001, com o header
  `Authorization: DeviceKey <key_id>:<secret>`, sem alterar o contrato
  existente.
- **AC-03**: O payload enviado contém apenas os campos já previstos na
  SPEC-001 (`hostname`, `battery_level`, `reported_ip`) — nenhum campo novo.
- **AC-04**: `battery_level` é omitido do payload quando o dispositivo não
  possui bateria ou quando a leitura falha — nunca um valor inventado.
- **AC-05**: Em caso de falha de rede, timeout ou erro 5xx do backend, o
  Agent aplica retry com exponential backoff e jitter (máximo ~30s), sem
  travar o restante do serviço.
- **AC-06**: Após atingir o limite máximo de backoff, o Agent continua
  tentando indefinidamente nesse intervalo, até a comunicação ser
  restabelecida — nunca desiste definitivamente.
- **AC-07**: Ao receber `401` (credencial inválida/revogada), o Agent
  registra o erro em log (sem key_id/secret) e continua tentando no próximo
  ciclo — não trava, não derruba o serviço.
- **AC-08**: Ao receber `422` (payload inválido — não deveria ocorrer, dado
  que o Agent só envia campos do contrato), o Agent registra o erro
  completo da resposta para investigação, sem crash.
- **AC-09**: O Agent nunca envia, calcula ou infere `communication_status`
  em nenhuma forma.
- **AC-10**: Uma falha de comunicação do Agent não apaga, sobrescreve ou
  altera de qualquer forma o histórico de heartbeats já persistido no
  backend.
- **AC-11**: O `secret` nunca aparece em nenhuma linha de log gerada pelo
  Agent, em nenhum nível de verbosidade.
- **AC-12**: O Agent é distribuído como executável único (`.exe`) e pode ser
  registrado como Windows Service, iniciando automaticamente com o sistema
  operacional e executando em background.
- **AC-13**: O intervalo de heartbeat é alterável editando o arquivo de
  configuração local, sem necessidade de recompilar o `.exe`.

## 14. Pontos em aberto para `plan.md`

- Formato do arquivo de configuração (JSON, YAML, INI ou outro).
- Biblioteca/abordagem de empacotamento (.exe) e de implementação do
  Windows Service.
- Mecanismo exato de recarregamento do `heartbeat_interval_seconds`: por
  ciclo (o Agent relê a configuração periodicamente) ou apenas no reinício
  do serviço.
- Estratégia de rotação/retenção dos logs locais.
- Biblioteca de coleta de telemetria local (hostname, IP, bateria) no
  Windows.

## 15. Referências

- ADR-006 — Identidade e autenticação de dispositivo.
- ADR-007 — Communication Status vs Operational State.
- ADR-008 — Reported IP vs Source IP.
- `specs/001-device-heartbeat/spec.md` — contrato consumido por este Agent.
- `PROJECT-CONTEXT.md`, seção 3 (REGRA 01 a REGRA 18).