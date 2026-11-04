# 📖 Manual de Operação do Cliente — Equipment Monitor

> **Plataforma de Monitoramento e Gestão Tática de Equipamentos em Eventos**  
> *Versão Homologada 1.0 — Produção*

---

## 1. Visão Geral da Plataforma

O **Equipment Monitor** é uma solução de centro de comando desenvolvida para o controle, rastreamento tático e telemetria em tempo real de ativos de TI (notebooks e smartphones corporativos) alocados em grandes eventos e feiras de negócios (como São Paulo Expo, Transamérica Expo Center e Anhembi).

A plataforma centraliza em uma única tela o estado de conectividade, carga de bateria, postos operacionais físicos e violações de perímetro territorial.

---

## 2. A Regra de Ouro Operacional

> ⚠️ **Princípio Fundamental:** O sistema **NUNCA** classifica um equipamento como roubado apenas pela ausência de comunicação.

A plataforma opera com dois eixos independentes:
1. **Status de Comunicação (Conectividade):**
   - 🟢 **ONLINE:** Transmitindo telemetria ativamente dentro do intervalo esperado.
   - 🟡 **SEM COMUNICAÇÃO:** Sinal não recebido nos últimos segundos (instabilidade transitória de Wi-Fi/4G).
   - ⚪ **OFFLINE:** Sem resposta prolongada (aparelho desligado, sem bateria, travamento ou fora de cobertura).
2. **Estado Operacional:**
   - `ATIVO`, `RECOLHIDO`, `EM MANUTENÇÃO` ou `DESATIVADO`.

A ausência de sinal pode ser decorrente de bateria esgotada, desligamento intencional no fim de turno ou bloqueio de sinal no pavilhão. Toda ação de recuperação deve seguir o protocolo operacional da empresa.

---

## 3. Acesso ao Sistema e Segurança

### 3.1 Login do Coordenador
1. Acesse o painel web através do navegador.
2. Insira seu **E-mail** e **Senha** cadastrados.
3. Clique em **Entrar**.

*Observação:* A sessão utiliza tokens criptográficos de alta segurança (Argon2 + JWT). Ao clicar em **Sair**, a sessão é imediatamente finalizada e o token removido do navegador.

---

## 4. Painel de Controle (Dashboard Geral)

Na tela principal de **Dispositivos**, o operador dispõe de:

- **Cards de Resumo no Topo:** Total de ativos, quantidade Online, Sem Comunicação e Offline.
- **Banner de Bateria Crítica:** Um alerta fixo no topo da tela destaca qualquer equipamento com **bateria ≤ 10%**, informando o patrimônio e posto para troca preventiva antes do desligamento.
- **Busca Rápida:** Filtre instantaneamente por número de patrimônio, hostname ou endereço IP.
- **Filtros de Estado:** Isole rapidamente apenas os equipamentos que necessitam de atenção.

---

## 5. Pareamento e Ativação de Equipamentos

Cada equipamento possui um identificador próprio e uma credencial única gerada na inclusão.

### 5.1 Ativação de Smartphones (Android)
1. No Dashboard, clique em **+ Novo Dispositivo** e preencha o patrimônio (ex: `SAMSUNG-001`).
2. Um **QR Code de ativação única** será exibido na tela.
3. No smartphone da operação, abra o app **Equipment Monitor**.
4. Aponte a câmera para o QR Code no painel. O aplicativo carrega as credenciais e inicia imediatamente a transmissão em segundo plano.
5. **Proteção contra desligamento não autorizado:** O app exibe notificação persistente. Para pausar ou fechar o monitoramento, o operador é obrigado a digitar o **PIN de Segurança do Coordenador (`2026`)**.

### 5.2 Ativação de Notebooks (Windows)
1. Baixe o executável portátil oficial (`asaph-agent.exe`).
2. Insira o arquivo `agent.toml` com a chave do dispositivo na mesma pasta.
3. Execute o aplicativo. Ele opera de forma **100% silenciosa em segundo plano** (`--noconsole`), coletando bateria, IP e telemetria a cada 30 segundos.
4. Para inicialização automática junto com o Windows, adicione um atalho em `shell:startup`.

---

## 6. Gestão de Eventos, Postos e Cerca Virtual (Geofencing)

A aba **Eventos** gerencia a distribuição territorial do evento.

### 6.1 Cadastro de Eventos e Definição da Cerca
- Ao criar o evento, define-se o local (ex: *São Paulo Expo*), as coordenadas centrais e o **Raio da Cerca Eletrônica** (padrão de **250 metros**).
- O sistema calcula a distância de cada aparelho em relação ao centro em metros usando a fórmula matemática de alta precisão **Haversine**.

### 6.2 Alocação em Postos Físicos (`location_point`)
- Vincule cada celular ou notebook ao seu ponto de uso (ex: `Credenciamento Portão A`, `Bilheteria Principal`, `Coordenação`).
- Defina o nome do colaborador responsável pelo manuseio naquele posto.
- O painel exibe a bateria atual de cada posto em tempo real com indicador visual de carga baixa.

### 6.3 Mapa Tático Operacional
- **Pinos Táticos (Dentro da Cerca):** Círculos verdes compactos de alta densidade com ícone de smartphone. Não poluem nem obstruem a visão mesmo com 40 a 50 aparelhos concentrados no pavilhão. Passe o mouse para ver o patrimônio e posto.
- **Base Central:** Marcada com ícone de QG (`🏢`).
- **🚨 Alerta de Rompimento de Cerca (Fuga/Saída Indevida):**
  - Se um aparelho ultrapassar os 250 metros do evento, o pino se transforma imediatamente em uma **pílula vermelha pulsante**.
  - O sistema eleva sua prioridade gráfica (`z-index: 9999`), garantindo que o alerta **nunca fique encoberto** por outros aparelhos.
  - Uma linha guia pontilhada vermelha é traçada da base até o ponto de evasão, com exibição da distância e velocidade estimada.

---

## 7. Substituição Operacional de Emergência (Swap no Ponto)

Se um equipamento quebrar, molhar ou esgotar a bateria no meio do evento:
1. Localize a linha do posto no painel do evento.
2. Clique na opção **Substituir (Swap)**.
3. Selecione o equipamento reserva disponível no estoque.
4. O sistema transfere automaticamente o posto e o responsável para o novo equipamento, recolhe o aparelho defeituoso e **preserva 100% do histórico de auditoria anterior** para conferência pós-evento.

---

## 8. Notificações Automáticas via Telegram

O sistema conta com integração nativa ao bot oficial **`🔔 Asaph-track`**:
- **Notificações de Queda:** Mudanças de estado de comunicação (`ONLINE` ➔ `SEM COMUNICAÇÃO` ➔ `OFFLINE`) disparam alertas imediatos para a equipe técnica.
- **Fuso Horário Oficial:** Todos os disparos utilizam rigorosamente o horário oficial de Brasília (**UTC-3**).

---

## 9. Guia Rápido de Troubleshooting (Resolução de Problemas)

| Ocorrência | Causa Provável | Ação Recomendada |
| :--- | :--- | :--- |
| **Aparelho ficou "Sem Comunicação"** | Perda momentânea de sinal de rede no pavilhão. | Aguardar 60 segundos; o sistema retoma automaticamente assim que o sinal restabelecer. |
| **Aparelho ficou "Offline"** | Bateria esgotada ou aparelho desligado pelo operador. | Checar no banner se a bateria estava baixa. Enviar supervisor ao posto físico para verificação. |
| **Alerta de Fuga Disparado no Mapa** | Aparelho transportado para fora do complexo. | Verificar no mapa a distância informada. Acionar rádio/segurança com base no nome do responsável e posto. |
| **Operador não consegue fechar o App** | Mecanismo de defesa ativo. | Digitar o PIN mestre do coordenador (`2026`) no diálogo de confirmação. |

---

*Equipment Monitor — Engenharia Confiável para Operações Críticas.*