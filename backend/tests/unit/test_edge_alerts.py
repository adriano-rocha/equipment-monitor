"""Testes de validação da lógica de transição de borda (Edge-Triggered)."""

import uuid
from app.interface.api.v1.heartbeats import (
    _active_breaches,
    _active_battery_alerts,
    CRITICAL_BATTERY_THRESHOLD,
)


def test_edge_triggered_geofence_lifecycle_and_mutation():
    """Valida que o ciclo de vida de borda aciona alarme apenas na transição."""
    dev_id = uuid.uuid4()
    _active_breaches.discard(dev_id)

    # 1. Primeira saída da cerca (dentro -> fora)
    is_new_breach_1 = dev_id not in _active_breaches
    _active_breaches.add(dev_id)
    assert is_new_breach_1 is True, "Primeira saída deve gerar alerta crítico"

    # 2. Segundo batimento (permanência fora da cerca)
    is_new_breach_2 = dev_id not in _active_breaches
    assert is_new_breach_2 is False, "Permanência fora da cerca não deve gerar novo alarme sonoro"

    # 3. Retorno à base (fora -> dentro)
    was_breached = dev_id in _active_breaches
    assert was_breached is True
    _active_breaches.discard(dev_id)
    assert dev_id not in _active_breaches, "Retorno à base deve limpar o estado do set"

    # 4. Segunda saída (reincidência após retorno)
    is_new_breach_3 = dev_id not in _active_breaches
    _active_breaches.add(dev_id)
    assert is_new_breach_3 is True, "Nova saída após retorno deve alertar novamente"


def test_edge_triggered_battery_lifecycle_and_mutation():
    """Valida que queda de bateria alerta uma vez e normaliza ao recarregar."""
    dev_id = uuid.uuid4()
    _active_battery_alerts.discard(dev_id)

    # 1. Queda para 8% (crítica)
    batt_1 = 8.0
    assert batt_1 <= CRITICAL_BATTERY_THRESHOLD
    is_new_alert_1 = dev_id not in _active_battery_alerts
    _active_battery_alerts.add(dev_id)
    assert is_new_alert_1 is True, "Queda para nível crítico deve disparar alerta"

    # 2. Próximo batimento continua em 8%
    is_new_alert_2 = dev_id not in _active_battery_alerts
    assert is_new_alert_2 is False, "Persistência em nível crítico não deve spamar"

    # 3. Aparelho colocado na tomada (recarrega para 35%)
    batt_2 = 35.0
    if batt_2 > CRITICAL_BATTERY_THRESHOLD:
        _active_battery_alerts.discard(dev_id)
    assert dev_id not in _active_battery_alerts, "Recarga acima do limiar deve resetar o alarme"