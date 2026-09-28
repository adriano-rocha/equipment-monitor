"""Windows Agent — PILOTO. Envia heartbeats à API; não é código de produção.

Fora do piloto de propósito: serviço Windows, backoff, log em arquivo, ACL, testes.
O Agent nunca calcula, envia nem declara status; o backend é a autoridade.
Requer Python >= 3.11 (tomllib).
"""

from __future__ import annotations

import ctypes
import ipaddress
import json
import logging
import os
import socket
import sys
import time
import tomllib
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger("agent")

HEARTBEAT_PATH = "/api/v1/heartbeats"
REQUEST_TIMEOUT_SECONDS = 10
MAX_LOGGED_BODY_BYTES = 1000
MIN_INTERVAL_SECONDS = 5
MAX_INTERVAL_SECONDS = 300


@dataclass(frozen=True)
class Config:
    url: str
    key_id: str
    secret: str = field(repr=False)
    interval_seconds: int


def load_config() -> Config:
    default_path = Path(__file__).with_name("agent.toml")
    path = Path(os.environ.get("EQUIPMENT_MONITOR_AGENT_CONFIG", default_path))
    try:
        with path.open("rb") as handle:
            raw = tomllib.load(handle)
    except FileNotFoundError:
        raise SystemExit(f"Config não encontrada: {path}") from None
    except tomllib.TOMLDecodeError as exc:
        raise SystemExit(f"Config com TOML inválido em {path}: {exc}") from None

    missing = [k for k in ("backend_url", "key_id", "secret") if not str(raw.get(k, "")).strip()]
    if missing:
        raise SystemExit(f"Config inválida: faltando {', '.join(missing)}")

    interval = int(raw.get("heartbeat_interval_seconds", 30))
    if not MIN_INTERVAL_SECONDS <= interval <= MAX_INTERVAL_SECONDS:
        raise SystemExit(
            f"heartbeat_interval_seconds deve estar entre "
            f"{MIN_INTERVAL_SECONDS} e {MAX_INTERVAL_SECONDS}"
        )
    return Config(
        url=str(raw["backend_url"]).strip().rstrip("/"),
        key_id=str(raw["key_id"]).strip(),
        secret=str(raw["secret"]).strip(),
        interval_seconds=interval,
    )


class _PowerStatus(ctypes.Structure):
    _fields_ = [
        ("ACLineStatus", ctypes.c_ubyte),
        ("BatteryFlag", ctypes.c_ubyte),
        ("BatteryLifePercent", ctypes.c_ubyte),
        ("SystemStatusFlag", ctypes.c_ubyte),
        ("BatteryLifeTime", ctypes.c_ulong),
        ("BatteryFullLifeTime", ctypes.c_ulong),
    ]


def _hostname() -> str | None:
    name = socket.gethostname().strip()
    return name[:255] or None


def _battery_level() -> int | None:
    if sys.platform != "win32":
        return None
    status = _PowerStatus()
    if not ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(status)):
        return None
    if status.BatteryFlag == 128 or status.BatteryLifePercent == 255:
        return None  # sem bateria ou nível desconhecido
    return min(status.BatteryLifePercent, 100)


def _reported_ip() -> str | None:
    # UDP connect() só consulta a tabela de rotas; nenhum pacote é enviado.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.connect(("192.0.2.1", 9))
        candidate = sock.getsockname()[0]
    address = ipaddress.ip_address(candidate)
    if address.is_loopback or address.is_link_local or address.is_unspecified:
        return None
    return str(address)


def _safe(name: str, collector: Callable[[], str | int | None]) -> str | int | None:
    try:
        return collector()
    except Exception:
        log.warning("Coletor '%s' falhou; campo omitido", name, exc_info=True)
        return None


def collect_payload() -> dict[str, str | int]:
    collected = {
        "hostname": _safe("hostname", _hostname),
        "battery_level": _safe("battery_level", _battery_level),
        "reported_ip": _safe("reported_ip", _reported_ip),
    }
    return {key: value for key, value in collected.items() if value is not None}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Evita reenviar o header Authorization para outro host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


def send_heartbeat(cfg: Config, payload: dict[str, str | int]) -> bool:
    request = urllib.request.Request(
        cfg.url + HEARTBEAT_PATH,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"DeviceKey {cfg.key_id}:{cfg.secret}",
            "Content-Type": "application/json",
            "User-Agent": "EquipmentMonitorAgent/pilot",
        },
    )
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            log.info("Heartbeat aceito (HTTP %s) payload=%s", response.status, payload)
            return True
    except urllib.error.HTTPError as exc:
        body = exc.read(MAX_LOGGED_BODY_BYTES).decode("utf-8", errors="replace")
        log.error("Heartbeat recusado (HTTP %s): %s", exc.code, body)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        log.error("Sem comunicação com o backend: %s", exc)
    return False


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config()
    once = "--once" in sys.argv
    log.info("Agent iniciado; destino=%s intervalo=%ss", cfg.url, cfg.interval_seconds)
    try:
        while True:
            ok = False
            try:
                ok = send_heartbeat(cfg, collect_payload())
            except Exception:
                log.exception("Falha inesperada no ciclo")
            if once:
                return 0 if ok else 1
            time.sleep(cfg.interval_seconds)
    except KeyboardInterrupt:
        log.info("Agent encerrado pelo usuário")
        return 0


if __name__ == "__main__":
    sys.exit(main())