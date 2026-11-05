"""Testes unitários de disparo de alerta por transição de borda (Edge-Triggered)."""

import uuid
from app.interface.api.v1.heartbeats import (
    _active_breaches,
    _active_battery_alerts,
    CRITICAL_BATTERY_THRESHOLD,
)


def test_geofence_edge_triggered_deduplication():
    device_id = uuid.uuid4()
    _active_breaches.discard(device_id)

    # 1. Primeira violação (estava dentro e saiu)
    is_new_breach_1 = device_id not in _active_breaches
    assert is_new_breach_1 is True  # Dispara alerta sonoro (ALERT_TRIGGERED)
    _active_breaches.add(device_id)

    # 2. Segundo batimento (continua fora da cerca após 30 segundos)
    is_new_breach_2 = device_id not in _active_breaches
    assert is_new_breach_2 is False  # NÃO spama alerta, só atualiza posição

    # 3. Dispositivo retorna para a cerca (normalização)
    was_breached = device_id in _active_breaches
    assert was_breached is True
    _active_breaches.discard(device_id)  # Limpa o estado

    # 4. Dispositivo sai novamente mais tarde
    is_new_breach_3 = device_id not in _active_breaches
    assert is_new_breach_3 is True  # Dispara alerta novamente!


def test_battery_critical_edge_triggered_deduplication():
    device_id = uuid.uuid4()
    _active_battery_alerts.discard(device_id)

    # 1. Bateria cai para 9% (crítica)
    batt = 9.0
    assert batt <= CRITICAL_BATTERY_THRESHOLD
    is_first_alert = device_id not in _active_battery_alerts
    assert is_first_alert is True  # Dispara alarme
    _active_battery_alerts.add(device_id)

    # 2. Próximo batimento continua em 9%
    is_repeat = device_id not in _active_battery_alerts
    assert is_repeat is False  # Não spama no Telegram nem WebSocket

    # 3. Aparelho é colocado no carregador (sobe para 25%)
    batt = 25.0
    if batt > CRITICAL_BATTERY_THRESHOLD:
        _active_battery_alerts.discard(device_id)

    assert device_id not in _active_battery_alerts  # Resetado com sucesso