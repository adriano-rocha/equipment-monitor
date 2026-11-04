# Equipment Monitor (Asaph-track)

Plataforma corporativa de monitoramento de saúde operacional, segurança patrimonial e rastreamento perimetral para equipamentos (notebooks Windows, smartphones e tablets Android) utilizados em feiras, convenções e grandes eventos.

A plataforma permite que a coordenação acompanhe em tempo real a conectividade, nível de bateria, IP reportado, postos operacionais alocados, violações de cercas virtuais georreferenciadas e histórico completo de auditoria para cada ativo.

Produto comercial validado, auditado e homologado em ambiente de produção na nuvem.

---

## 🌐 Ambientes em Produção

* **Central de Controle (Dashboard Web):**  
  [https://asaph-track.vercel.app/](https://asaph-track.vercel.app/)
* **Backend API (Docker / FastAPI / Render):**  
  [https://equipment-monitor-fd2u.onrender.com](https://equipment-monitor-fd2u.onrender.com)
* **Banco de Dados Gerenciado:**  
  PostgreSQL 16 (Neon Serverless Database).
* **Canal Oficial de Alertas:**  
  Bot Telegram (`🔔 Asaph-track`) com fuso horário oficial de Brasília (UTC-3).

---

## 🚀 Capacidades Homologadas do Sistema

* ✅ **Cerca Virtual & Detecção de Evasão:** Definição de raios de cobertura georreferenciados (100m, 250m, 500m) com cálculo esférico via fórmula de Haversine. Detecção instantânea de evasão, cálculo de vetor de fuga, velocidade estimada e distância da base em tempo real.
* ✅ **Pinos Táticos Anti-Sobreposição:** Renderização cartográfica no Leaflet (paleta dark de alta legibilidade) com micro-pinos táticos de 22px identificando notebooks, tablets e smartphones. Em caso de rompimento de cerca ou evasão, o pino se expande automaticamente para cápsula de alerta vermelha com prioridade visual absoluta (`zIndexOffset: 9999`).
* ✅ **Monitoramento de Bateria & Telemetria:** Sincronização da telemetria de bateria dos equipamentos na listagem geral e nas tabelas por posto de evento, com filtro instantâneo de **Bateria Baixa/Crítica (≤ 20%)**.
* ✅ **Reativação Inteligente de Patrimônio (*Undelete*):** Tratamento de exclusão lógica (*soft delete*) com preservação da trilha de auditoria histórica, permitindo recadastramento imediato do mesmo patrimônio com emissão de novas credenciais ativas.
* ✅ **Arquitetura Limpa e Desacoplada:** Interface modularizada com modais atômicos e isolamento de ciclo de vida do mapa, garantindo zero re-renderizações em cascata e alta performance em telas operacionais.
* ✅ **Segurança e Criptografia ADR-006:** Handshake de autenticação dos agentes baseado em esquema de chaves (`DeviceKey <key_id>:<secret>`) com hashing unidirecional de alto custo via **Argon2id**. Nem mesmo a equipe de banco de dados tem acesso ao secret após a emissão.
* ✅ **Agente Android Universal (Asaph-track):** Aplicativo nativo em Kotlin com leitura rápida de provisionamento via QR Code, Foreground Service persistente para Android 8 até Android 15, `LocationListener` contínuo em segundo plano e parada protegida por PIN do coordenador (`3011`).
* ✅ **Agente Windows:** Executável portátil autônomo (`asaph-agent.exe`) compilado via PyInstaller com execução em background silencioso (`--noconsole`) e inicialização integrada ao sistema operacional (`shell:startup`).

---

## 🛠️ Stack Tecnológica

* **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (Clean Architecture / DDD), Alembic, Pydantic v2, Argon2-cffi, JWT (sessões administrativas), WebSockets com broadcast nativo.
* **Frontend:** React 19, Vite, Tailwind CSS, Leaflet (`asaph-dark-tiles`), WebSockets nativos, QRCodeSVG.
* **Agente Android:** Kotlin, Google ML Kit (leitura de QR Code), Android Location Framework, Foreground Service (`dataSync|location`).
* **Agente Windows:** Python 3.12, Win32 API (`ctypes` PowerStatus), `tomllib`, executável binário via PyInstaller.
* **Infraestrutura:** Render Cloud (API), Neon (PostgreSQL gerenciado), Vercel (Front-end SPA), Docker Compose (Ambiente local e suíte de testes).
* **Qualidade de Software:** Pytest com 57 testes automatizados cobrindo autenticação, telemetria, use cases, regras de cerca e persistência.

---

## 📖 Documentação do Projeto

1. [`PROJECT-CONTEXT.md`](./PROJECT-CONTEXT.md) — Visão técnica consolidada da arquitetura, modelo de domínio, padrões de segurança e fluxos de dados.
2. [`MANUAL_DO_CLIENTE.md`](./MANUAL_DO_CLIENTE.md) — Guia operacional executivo para coordenadores de evento e clientes finais.
3. [`docs/adr/`](./docs/adr/) — Registro formal de Decisões Arquiteturais (ADR-001 a ADR-006).
4. [`specs/`](./specs/) — Especificações técnicas das entregas no padrão Spec-Driven Development (SDD).

---

## ⚡ Guia Rápido de Operação

### 1. Central de Controle (Dashboard)
Acesse [https://asaph-track.vercel.app/](https://asaph-track.vercel.app/), realize o login administrativo e:
* **Cadastre Equipamentos:** Clique em `+ Cadastrar dispositivo` para gerar o QR Code (Mobile) ou as chaves de configuração (Windows).
* **Crie Eventos e Cercas:** Na aba *Eventos / Postos*, crie o evento marcando a localização central no mapa e definindo o raio de tolerância (100m, 250m ou 500m).
* **Vincule Equipamentos aos Postos:** Alavanque a auditoria associando cada patrimônio ao seu posto físico (ex: *Portão 1*, *Credenciamento*, *Sala VIP*).

### 2. Dispositivos Android (Smartphones / Tablets)
1. Instale o APK oficial no aparelho.
2. Abra o app **Asaph-track** e toque em **Escanear QR Code**.
3. Aponte a câmera para a tela do Dashboard para preencher automaticamente as credenciais criptográficas.
4. Toque em **Iniciar Monitoramento** e conceda as permissões de notificação e localização em segundo plano.
   *(Para interromper o monitoramento em campo, digite o PIN do coordenador: `3011`).*

### 3. Notebooks e PCs Windows
1. Copie a pasta contendo `asaph-agent.exe` e `agent.toml` para o computador alvo.
2. Edite o `agent.toml` com as chaves geradas no painel:
   ```toml
   backend_url = "https://equipment-monitor-fd2u.onrender.com"
   key_id = "key_xxxxxxxx"
   secret = "sec_xxxxxxxxxxxxxxxx"
   heartbeat_interval_seconds = 30
  ```

1. Dê dois cliques em asaph-agent.exe. O agente executará silenciosamente em segundo plano, registrando telemetria em agent.log.
2. (Opcional) Crie um atalho do executável na pasta shell:startup para que ele inicie automaticamente ao ligar o computador.

🧪 Testes Automatizados (Backend)
Com o banco de testes ativo no Docker, execute no diretório backend/:
Powershell
uv run pytest
Saída esperada:
Text
======================= 57 passed in 5.xxs =======================