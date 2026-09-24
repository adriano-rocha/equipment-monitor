# ADR-003 — Arquitetura de Heartbeat e cálculo de status

## Status
Aceita

## Contexto
REGRA 09 e REGRA 10: o backend decide se um dispositivo está online/sem comunicação; o agente nunca se autodeclara offline. Precisa haver um cálculo determinístico e configurável.

## Decisão
- O agente (Windows/Android) envia periodicamente `POST /api/v1/heartbeats` com hostname, IP, bateria e SO.
- O backend persiste cada heartbeat (histórico completo, REGRA 07) e atualiza `devices.last_seen`.
- O status do dispositivo é derivado, não armazenado como fonte primária de verdade a cada heartbeat:
  ```
  se (agora - last_seen) > OFFLINE_THRESHOLD_SECONDS → SEM COMUNICAÇÃO
  senão → ONLINE
  ```
- `HEARTBEAT_INTERVAL_SECONDS` (sugerido: 30) e `OFFLINE_THRESHOLD_SECONDS` (sugerido: 90) são configuráveis via variável de ambiente no MVP, não hardcoded. Granularidade por dispositivo/evento fica em aberto (ver PROJECT-CONTEXT.md, pendência 4) e só será implementada se houver necessidade real comprovada.
- Um estado explícito `OFFLINE` (distinto de `SEM COMUNICAÇÃO`) é reservado para transições administrativas futuras (ex.: equipamento formalmente recolhido do evento) — não implementado em SPEC-001/SPEC-002, documentado aqui para não ser reinventado depois.

## Consequências
- Cálculo de status pode ser feito sob demanda (ao consultar) e/ou via job periódico que atualiza `devices.status` — a escolha entre essas duas estratégias fica para o `plan.md` da SPEC-002 (Device Offline Detection).
- Nunca inferir "roubado" a partir de SEM COMUNICAÇÃO/OFFLINE (REGRA 11).
