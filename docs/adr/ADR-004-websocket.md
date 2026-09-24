# ADR-004 — WebSocket para atualização em tempo real do Dashboard

## Status
Aceita (implementação adiada para Fase 05)

## Contexto
O dashboard não deve depender exclusivamente de refresh manual quando o status de um equipamento muda.

## Decisão
Usar o suporte nativo a WebSocket do FastAPI. Fluxo: mudança de status detectada no backend → evento interno → broadcast via WebSocket → dashboard atualiza a UI. Antes da Fase 05, o dashboard (Fase 04) usa polling/refresh manual como fallback aceitável para o MVP inicial.

## Consequências
- Evita over-engineering prematuro: a Fase 04 entrega valor real (visualização) sem exigir WebSocket ainda.
- Fase 05 precisa de um mecanismo de pub/sub interno simples (fila em memória ou tabela de eventos) para disparar o broadcast — desenho detalhado fica para a spec da Fase 05.
