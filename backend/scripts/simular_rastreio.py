"""
Script Multi-Cenários de Rastreamento Perimetral e Auditoria ADR-006.
Permite testar:
1. Rompimento a pé (PERIMETER_BREACH)
2. Evasão em alta velocidade (HIGH_SPEED_EVASION)
3. Bateria crítica (BATTERY_CRITICAL)
4. Retorno à área de cobertura (Normalização)
5. Rejeição de credencial inválida (ADR-006 Security)
"""

import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request
from uuid import uuid4
from argon2 import PasswordHasher
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Garante importação dos módulos da pasta app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if "DATABASE_URL" not in os.environ:
    for env_file in [".env", "../.env", "../../.env"]:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), env_file))
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("DATABASE_URL="):
                        val = line.strip().split("=", 1)[1].strip("'\"")
                        os.environ["DATABASE_URL"] = val
                        break

from app.application.use_cases.create_device_use_case import (
    CreateDeviceInput,
    CreateDeviceUseCase,
)
from app.infrastructure.db.models.device_credential_model import (
    DeviceCredentialModel,
)
from app.infrastructure.db.models.device_model import DeviceModel
from app.infrastructure.db.repositories.sqlalchemy_device_credential_repository import (
    SqlAlchemyDeviceCredentialRepository,
)
from app.infrastructure.db.repositories.sqlalchemy_device_repository import (
    SqlAlchemyDeviceRepository,
)

try:
    from app.domain.device_credential import CredentialStatus
    ACTIVE_STATUS = CredentialStatus.ACTIVE
except ImportError:
    try:
        from app.infrastructure.db.models.device_credential_model import DeviceCredentialStatus
        ACTIVE_STATUS = DeviceCredentialStatus.ACTIVE
    except ImportError:
        ACTIVE_STATUS = "ACTIVE"

API_URL = "http://localhost:8000/api/v1/heartbeats"
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Erro: DATABASE_URL não encontrada.")
    sys.exit(1)


def obter_credenciais_validas():
    engine = create_engine(DATABASE_URL)
    hasher = PasswordHasher()

    with Session(engine) as session:
        aparelho = session.query(DeviceModel).filter_by(asset_number="SIM-RASTREIO").first()

        if aparelho:
            key_id = f"key_{uuid4().hex[:8]}"
            raw_secret = f"sec_{secrets.token_hex(16)}"
            secret_hash = hasher.hash(raw_secret)

            cred = session.query(DeviceCredentialModel).filter_by(device_id=aparelho.id).first()
            if cred:
                cred.key_id = key_id
                cred.secret_hash = secret_hash
                cred.status = ACTIVE_STATUS
            else:
                cred = DeviceCredentialModel(
                    device_id=aparelho.id,
                    key_id=key_id,
                    secret_hash=secret_hash,
                    status=ACTIVE_STATUS,
                )
                session.add(cred)

            session.commit()
        else:
            device_repo = SqlAlchemyDeviceRepository(session)
            cred_repo = SqlAlchemyDeviceCredentialRepository(session)
            use_case = CreateDeviceUseCase(device_repo, cred_repo)
            res = use_case.execute(
                CreateDeviceInput(
                    asset_number="SIM-RASTREIO",
                    device_type="smartphone",
                    manufacturer="Asaph",
                    model="GPS Tracker",
                    serial_number="SIM-001",
                )
            )
            session.commit()
            key_id = str(res.key_id)
            raw_secret = str(res.secret)

        headers = {
            "Authorization": f"DeviceKey {key_id}:{raw_secret}",
            "Content-Type": "application/json",
        }
        return headers


def post_json(url, data, headers):
    json_bytes = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=json_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 500, str(e)


def menu():
    headers = obter_credenciais_validas()

    while True:
        print("\n=======================================================")
        print("          CENTRAL DE SIMULAÇÕES ASAPH - ADR-006        ")
        print("=======================================================")
        print("1. [NORMAL] Enviar coordenada dentro da Cerca (Raio 250m)")
        print("2. [ALERTA] Rompimento Perimetral a Pé (speed = 4 km/h)")
        print("3. [CRÍTICO] Fuga em Alta Velocidade (speed = 68 km/h)")
        print("4. [BATERIA] Alerta de Bateria Crítica (5%)")
        print("5. [SEGURANÇA] Teste com Credencial Incorreta (HTTP 401)")
        print("0. Sair")
        print("=======================================================")
        opcao = input("Escolha um cenário (0-5): ").strip()

        if opcao == "1":
            print("\n📡 Enviando batimento DENTRO da cerca...")
            payload = {
                "hostname": "device-simulador",
                "reported_ip": "192.168.15.50",
                "battery_level": 92,
                "latitude": -23.6477,
                "longitude": -46.6292,
                "speed_kmh": 2.5,
            }
            status, resp = post_json(API_URL, payload, headers)
            print(f"Status: HTTP {status} | Resposta: {resp}")

        elif opcao == "2":
            print("\n🚨 Enviando batimento FORA da cerca a pé (~1050m)...")
            payload = {
                "hostname": "device-simulador",
                "reported_ip": "192.168.15.50",
                "battery_level": 88,
                "latitude": -23.6560,
                "longitude": -46.6340,
                "speed_kmh": 4.5,
            }
            status, resp = post_json(API_URL, payload, headers)
            print(f"Status: HTTP {status} | Resposta: {resp}")

        elif opcao == "3":
            print("\n🚗💨 Enviando batimento de EVASÃO RÁPIDA (68 km/h fora da cerca)...")
            payload = {
                "hostname": "device-simulador",
                "reported_ip": "192.168.15.50",
                "battery_level": 70,
                "latitude": -23.6620,
                "longitude": -46.6400,
                "speed_kmh": 68.0,
            }
            status, resp = post_json(API_URL, payload, headers)
            print(f"Status: HTTP {status} | Resposta: {resp}")

        elif opcao == "4":
            print("\n🔋 Enviando batimento com BATERIA CRÍTICA (5%)...")
            payload = {
                "hostname": "device-simulador",
                "reported_ip": "192.168.15.50",
                "battery_level": 5,
                "latitude": -23.6477,
                "longitude": -46.6292,
                "speed_kmh": 0.0,
            }
            status, resp = post_json(API_URL, payload, headers)
            print(f"Status: HTTP {status} | Resposta: {resp}")

        elif opcao == "5":
            print("\n🛡️ Testando rejeição com chave falsificada...")
            fake_headers = {
                "Authorization": "DeviceKey fake_key:invalid_secret_12345",
                "Content-Type": "application/json",
            }
            payload = {
                "hostname": "device-hacker",
                "reported_ip": "10.0.0.99",
                "battery_level": 100,
                "latitude": -23.6477,
                "longitude": -46.6292,
                "speed_kmh": 0.0,
            }
            status, resp = post_json(API_URL, payload, fake_headers)
            print(f"Status: HTTP {status} (Esperado 401) | Resposta: {resp}")

        elif opcao == "0":
            print("Encerrando simulador.")
            break
        else:
            print("Opção inválida.")


if __name__ == "__main__":
    menu()