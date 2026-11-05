# ADR-009: Estado de Borda de Alertas em Memória de Processo

## Status
Aceito (Trade-off para MVP v1.0)

## Contexto
O monitoramento contínuo de cerca virtual e telemetria de bateria envia heartbeats a cada 30 segundos. Para evitar envenenamento de WebSockets e spam de notificações no Telegram, o sistema adota disparos orientados a borda (*edge-triggered*).

## Decisão
Na versão v1.0, o estado da transição de alarme é mantido em estruturas `set[UUID]` em memória do processo (`_active_breaches` e `_active_battery_alerts`).

## Premissas Operacionais & Limitações Conhecidas
1. **Worker Único:** O backend em produção na Render opera sob um único dyno/container e um único worker Uvicorn (`--workers 1`), garantindo integridade de estado local.
2. **Reinício do Container:** Se o serviço reiniciar na nuvem, o conjunto em memória é reinicializado. Aparelhos que já estiverem fora da base dispararão um único alerta na sua próxima telemetria.
3. **Evolução (Roadmap v1.1):** O estado de borda será migrado para chave TTL no Redis ou tabela de persistência de alertas no PostgreSQL quando a operação exigir múltiplos workers concorrentes.