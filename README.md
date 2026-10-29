# Equipment Monitor (Asaph-track)

Plataforma multiplataforma de monitoramento de saúde operacional e segurança patrimonial para equipamentos (notebooks Windows / smartphones e tablets Android) utilizados em eventos corporativos. Permite que a coordenação acompanhe em tempo real a conectividade, nível de bateria, IP reportado, postos alocados e histórico de auditoria de cada ativo.

Este é o MVP de um produto comercial real, validado e homologado em ambiente de produção na nuvem.

---

## 🌐 Ambientes em Produção

* **Central de Controle (Dashboard Web):**  
  [https://asaph-equipment-control.vercel.app](https://asaph-equipment-control.vercel.app)
* **Backend API (Docker / FastAPI):**  
  [https://equipment-monitor-fd2u.onrender.com](https://equipment-monitor-fd2u.onrender.com)
* **Canal Oficial de Alertas:**  
  Bot Telegram (`🔔 Asaph-track`) com fuso horário oficial de Brasília (UTC-3).

---

## 🚀 Estado Atual do Projeto

**Todas as etapas do MVP estão 100% concluídas e homologadas em produção:**

* ✅ **Backend API:** FastAPI no Render com PostgreSQL gerenciado, migrações automáticas via Alembic no boot do container (`alembic upgrade head`), 57 testes automatizados verdes (`pytest`) e CORS restrito via regex para `*.vercel.app`.
* ✅ **Dashboard Web:** React + Vite na Vercel com WebSocket em tempo real, busca instantânea, filtros combinados, paginação, central de alertas de bateria crítica (≤ 10%) e gestão de postos operacionais.
* ✅ **Android Agent (Asaph-track):** Aplicativo nativo em Kotlin com leitura rápida de configuração via QR Code, Foreground Service persistente e botão "Parar" protegido por PIN do coordenador (`2026`).
* ✅ **Windows Agent:** Executável portátil autônomo (`asaph-agent.exe`) gerado via PyInstaller com flag `--noconsole` (execução 100% silenciosa em segundo plano, sem janelas visíveis de CMD) e suporte a inicialização com o Windows (`shell:startup`).
* ✅ **Notificações Telegram:** Disparo automático de alertas para transições de estado (`ONLINE`, `SEM COMUNICAÇÃO`, `OFFLINE`) e recuperação de sinal com cabeçalho oficial e fuso de Brasília.

---

## 🛠️ Stack Tecnológica

* **Backend:** Python 3.12+, FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, Pydantic v2, Argon2 (hashing de credenciais dos agentes), JWT (sessão administrativa).
* **Frontend:** React, Vite, Tailwind CSS, WebSocket nativo, QRCodeSVG.
* **Agente Windows:** Python 3.12+, `ctypes` (Win32 PowerStatus), `tomllib`, empacotado em `.exe` portátil via PyInstaller (`--noconsole`).
* **Agente Android:** Kotlin, Google ML Kit (leitura de QR Code), Foreground Service, `android.app.AlertDialog`.
* **Infraestrutura e Deploy:** Render (Backend + Postgres), Vercel (Frontend), Docker.
* **Testes Automatizados:** Pytest (57 testes unitários e de integração cobrindo 100% das regras críticas).

---

## 📖 Documentação Essencial (leia nesta ordem)

1. [`PROJECT-CONTEXT.md`](./PROJECT-CONTEXT.md) — contexto amplo do produto, regras de negócio, modelo conceitual e fases.
2. [`CLAUDE.md`](./CLAUDE.md) — regras permanentes de engenharia seguidas no projeto.
3. [`docs/adr/`](./docs/adr/) — decisões arquiteturais registradas (ADR-001 a ADR-006).
4. [`specs/`](./specs/) — especificações formais de cada vertical slice implementado.

---

## ⚡ Como Operar o Sistema

### 1. Central de Controle (Dashboard)
Acesse [https://asaph-track.vercel.app/](https://asaph-track.vercel.app/), realize o login administrativo e cadastre os equipamentos desejados (`+ Cadastrar equipamento`) para obter o QR Code (Mobile) ou as chaves de texto (Notebook).

### 2. Dispositivos Android (Smartphones / Tablets)
1. Instale o APK no aparelho.
2. Abra o app **Asaph-track** e toque em **Escanear QR Code**.
3. Aponte a câmera para a tela do Dashboard para preencher automaticamente as credenciais.
4. Toque em **Iniciar Monitoramento**. (A parada exige o PIN do coordenador: `2026`).

### 3. Notebooks e PCs Windows
1. Copie a pasta contendo `asaph-agent.exe` e `agent.toml` para o notebook.
2. Edite o `agent.toml` com as chaves geradas no Dashboard:
   ```toml
   backend_url = "https://equipment-monitor-fd2u.onrender.com"
   key_id = "key_xxxxxxxx"
   secret = "sec_xxxxxxxxxxxxxxxx"
   heartbeat_interval_seconds = 30

   
Model 8:29 AM
Sim! O README.md está completamente desatualizado em relação à realidade do projeto:
Diz que a "Fase 01 está em andamento", quando na verdade o sistema já está com todas as fases implementadas e homologadas em produção.
Diz que o empacotamento do Windows Agent como .exe é "futuro", quando já temos o asaph-agent.exe compilado com modo silencioso.
Não cita as URLs de produção ativas (Render e Vercel), nem os mecanismos reais de QR Code e proteção por PIN.
A seção "Como rodar" diz "a definir na Fase 02".
Aqui está a versão completa, profissional e atualizada para substituir no seu README.md:
code
Markdown
# Equipment Monitor (Asaph-track)

Plataforma multiplataforma de monitoramento de saúde operacional e segurança patrimonial para equipamentos (notebooks Windows / smartphones e tablets Android) utilizados em eventos corporativos. Permite que a coordenação acompanhe em tempo real a conectividade, nível de bateria, IP reportado, postos alocados e histórico de auditoria de cada ativo.

Este é o MVP de um produto comercial real, validado e homologado em ambiente de produção na nuvem.

---

## 🌐 Ambientes em Produção

* **Central de Controle (Dashboard Web):**  
  [https://asaph-equipment-control.vercel.app](https://asaph-equipment-control.vercel.app)
* **Backend API (Docker / FastAPI):**  
  [https://equipment-monitor-fd2u.onrender.com](https://equipment-monitor-fd2u.onrender.com)
* **Canal Oficial de Alertas:**  
  Bot Telegram (`🔔 Asaph-track`) com fuso horário oficial de Brasília (UTC-3).

---

## 🚀 Estado Atual do Projeto

**Todas as etapas do MVP estão 100% concluídas e homologadas em produção:**

* ✅ **Backend API:** FastAPI no Render com PostgreSQL gerenciado, migrações automáticas via Alembic no boot do container (`alembic upgrade head`), 57 testes automatizados verdes (`pytest`) e CORS restrito via regex para `*.vercel.app`.
* ✅ **Dashboard Web:** React + Vite na Vercel com WebSocket em tempo real, busca instantânea, filtros combinados, paginação, central de alertas de bateria crítica (≤ 10%) e gestão de postos operacionais.
* ✅ **Android Agent (Asaph-track):** Aplicativo nativo em Kotlin com leitura rápida de configuração via QR Code, Foreground Service persistente e botão "Parar" protegido por PIN do coordenador (`2026`).
* ✅ **Windows Agent:** Executável portátil autônomo (`asaph-agent.exe`) gerado via PyInstaller com flag `--noconsole` (execução 100% silenciosa em segundo plano, sem janelas visíveis de CMD) e suporte a inicialização com o Windows (`shell:startup`).
* ✅ **Notificações Telegram:** Disparo automático de alertas para transições de estado (`ONLINE`, `SEM COMUNICAÇÃO`, `OFFLINE`) e recuperação de sinal com cabeçalho oficial e fuso de Brasília.

---

## 🛠️ Stack Tecnológica

* **Backend:** Python 3.12+, FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, Pydantic v2, Argon2 (hashing de credenciais dos agentes), JWT (sessão administrativa).
* **Frontend:** React, Vite, Tailwind CSS, WebSocket nativo, QRCodeSVG.
* **Agente Windows:** Python 3.12+, `ctypes` (Win32 PowerStatus), `tomllib`, empacotado em `.exe` portátil via PyInstaller (`--noconsole`).
* **Agente Android:** Kotlin, Google ML Kit (leitura de QR Code), Foreground Service, `android.app.AlertDialog`.
* **Infraestrutura e Deploy:** Render (Backend + Postgres), Vercel (Frontend), Docker.
* **Testes Automatizados:** Pytest (57 testes unitários e de integração cobrindo 100% das regras críticas).

---

## 📖 Documentação Essencial (leia nesta ordem)

1. [`PROJECT-CONTEXT.md`](./PROJECT-CONTEXT.md) — contexto amplo do produto, regras de negócio, modelo conceitual e fases.
2. [`CLAUDE.md`](./CLAUDE.md) — regras permanentes de engenharia seguidas no projeto.
3. [`docs/adr/`](./docs/adr/) — decisões arquiteturais registradas (ADR-001 a ADR-006).
4. [`specs/`](./specs/) — especificações formais de cada vertical slice implementado.

---

## ⚡ Como Operar o Sistema

### 1. Central de Controle (Dashboard)
Acesse [https://asaph-equipment-control.vercel.app](https://asaph-equipment-control.vercel.app), realize o login administrativo e cadastre os equipamentos desejados (`+ Cadastrar equipamento`) para obter o QR Code (Mobile) ou as chaves de texto (Notebook).

### 2. Dispositivos Android (Smartphones / Tablets)
1. Instale o APK no aparelho.
2. Abra o app **Asaph-track** e toque em **Escanear QR Code**.
3. Aponte a câmera para a tela do Dashboard para preencher automaticamente as credenciais.
4. Toque em **Iniciar Monitoramento**. (A parada exige o PIN do coordenador: `2026`).

### 3. Notebooks e PCs Windows
1. Copie a pasta contendo `asaph-agent.exe` e `agent.toml` para o notebook.
2. Edite o `agent.toml` com as chaves geradas no Dashboard:
   ```toml
   backend_url = "https://equipment-monitor-fd2u.onrender.com"
   key_id = "key_xxxxxxxx"
   secret = "sec_xxxxxxxxxxxxxxxx"
   heartbeat_interval_seconds = 30


Dê dois cliques em asaph-agent.exe. O agente rodará silenciosamente em segundo plano, registrando logs em agent.log.
(Opcional) Crie um atalho do .exe na pasta shell:startup para iniciar automaticamente com o Windows.
🧪 Como Rodar os Testes Automatizados (Backend)
No diretório backend/, com o ambiente virtual ativo:
code
Powershell
cd backend
pytest -v
Resultado esperado: 57 passed.
