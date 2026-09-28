# CLAUDE.md — Equipment Monitor

Manual permanente para qualquer agente de IA (Claude ou outro) trabalhando neste repositório. Leia isto **antes** de escrever código. Para contexto de produto/negócio, ver `PROJECT-CONTEXT.md`. Para requisitos de uma funcionalidade específica, ver `specs/<nome-da-spec>/`.

## Postura esperada

Atue como engenheiro sênior / tech lead. Este é um produto comercial real, não um exercício.

- Não gere código só porque foi pedido, sem analisar o impacto arquitetural.
- Antes de implementar algo relevante: analise contexto → verifique regras de negócio → verifique specs → verifique arquitetura → verifique estado atual (`PROJECT-CONTEXT.md`) → identifique dependências → proponha abordagem → só então implemente.
- Não invente requisitos. Ambiguidade relevante = registrar como pendência em `PROJECT-CONTEXT.md`, não decidir sozinho quando depender do negócio.
- Evite: overengineering, abstrações sem necessidade, microserviços prematuros, dependências desnecessárias, duplicação, lógica de negócio em controllers, lógica de infraestrutura no domínio.
- Prefira: simplicidade, clareza, testabilidade, baixo acoplamento, entregas pequenas, decisões justificadas.
- Pergunta guia: "Qual é a menor implementação profissional que entrega este valor?"

## Metodologia: Spec-Driven Development (SDD)

Fluxo obrigatório por funcionalidade relevante:

```
SPECIFY → PLAN → TASKS → IMPLEMENT → TEST → REVIEW → COMMIT → DOCUMENT → NEXT SPEC
```

- Nunca pule direto para implementação sem uma spec compreendida.
- Desenvolva em **vertical slices** (uma capacidade funcional completa de ponta a ponta), não "todo o backend, depois todo o frontend".
- Cada spec vive em `specs/NNN-nome/` com `spec.md` (o quê / por quê / regras / critérios de aceitação), `plan.md` (como) e `tasks.md` (tarefas).
- Uma spec só é considerada concluída com: requisitos + implementação + testes + documentação + revisão + commit.

## Arquitetura: Clean Architecture (pragmática, não dogmática)

Camadas, sem depender diretamente de frameworks externos na regra de negócio:

- **Domain** — entidades e regras de negócio puras.
- **Application / Use Cases** — orquestração dos casos de uso.
- **Infrastructure** — banco (SQLAlchemy), integrações externas (Telegram, Google/Android Management).
- **Interface / API** — FastAPI (rotas, schemas Pydantic, WebSocket).

Objetivo: baixo acoplamento + alta coesão + testabilidade + manutenibilidade. Não aplicar a separação de forma excessiva onde não agrega valor.

## Clientes de dispositivo e contratos de API

Clientes como Windows Agent e Android App são consumidores da API/backend. Eles não substituem o backend como autoridade das regras de negócio.

Ao trabalhar em um cliente de dispositivo:

* Ler a SPEC do cliente em implementação.
* Ler as specs/contratos do backend que o cliente consome.
* Não duplicar regras de negócio do backend no cliente sem justificativa explícita.
* Não permitir que o cliente determine estados de negócio que pertencem ao backend.
* Não alterar contratos existentes de API silenciosamente.
* Alterações necessárias em contratos devem ser identificadas, justificadas e refletidas na spec/ADR correspondente antes da implementação.
* O cliente deve tratar falhas de comunicação como falhas de comunicação, e não convertê-las em estados de negócio por conta própria.

Para o Windows Agent, além deste arquivo, são obrigatórios como referência:

* `specs/001-device-heartbeat/spec.md`
* `specs/002-windows-agent/spec.md`
* `specs/002-windows-agent/plan.md`
* `specs/002-windows-agent/tasks.md`

O `TASKS-002` é a referência operacional da implementação da Fase 03.

## Regras de negócio permanentes

Ver `PROJECT-CONTEXT.md` seção 3 — são 18 regras (REGRA 01 a REGRA 18) e não devem ser reinterpretadas sem uma ADR explícita. As mais críticas para qualquer código novo:

- `communication_status` é determinado pelo backend e utiliza `ONLINE` / `SEM_COMUNICACAO`.
- `operational_state` é um conceito separado e utiliza `ATIVO` / `RECOLHIDO` / `EM_MANUTENCAO` / `DESATIVADO`.
- O agente nunca calcula, envia ou determina `communication_status` e nunca se autodeclara `OFFLINE`.
- Ausência de comunicação nunca deve ser interpretada pelo sistema como "roubo".
- `asset_number` (patrimônio) nunca é chave primária.
- Relação equipamento↔evento é N:N via `event_devices`, nunca um campo fixo em `devices`.

## Banco de dados

- Toda alteração estrutural usa **Alembic** (migration rastreável). Nunca editar schema manualmente em produção como método principal.
- Preservar histórico (heartbeats, alertas) — não sobrescrever, inserir.

## Testes

Não são opcionais. Prioridade: unitários → integração → API → E2E quando justificável. Regras de negócio devem ser testáveis independentemente de infraestrutura (banco, FastAPI). Não criar testes artificiais só para elevar cobertura — testes devem representar comportamento real (ex.: heartbeat válido atualiza `last_seen`; dispositivo inexistente é rejeitado; tthreshold ultrapassado altera `communication_status` para `SEM_COMUNICACAO`; heartbeat de volta retorna para `ONLINE`).

## Segurança

- Nunca commitar `.env`, senhas, tokens, chaves, secrets.
- Segredos via variáveis de ambiente.
- Credenciais de dispositivo devem seguir o contrato definido na SPEC correspondente. O `secret` nunca deve ser hardcoded, exposto em logs, argumentos de linha de comando, URLs ou mensagens de erro.
- O Windows Agent não deve fazer hash nem validação criptográfica do `secret`; essa responsabilidade pertence ao backend conforme o contrato de autenticação.
- Não registrar credenciais ou material sensível em telemetria, mensagens de diagnóstico ou arquivos de log.
- Senhas com hash seguro (bcrypt/argon2, nunca texto plano ou hash fraco).
- Toda entrada externa validada via Pydantic.
- Endpoints protegidos exigem autenticação (JWT para usuários; credencial de dispositivo própria para agentes — ver ADR-006).
- Ações administrativas exigem autorização por papel.

## Git e commits

- Cada fase/spec relevante termina com commit (`feat: implement device heartbeat`, etc.).
- Não acumular múltiplas funcionalidades sem commit.
- Antes de finalizar uma fase: rodar testes, revisar mudanças, checar documentação e migrations, atualizar `PROJECT-CONTEXT.md`, então commitar.

## Decisões arquiteturais (ADR)

Decisões arquiteturais relevantes vão em `docs/adr/ADR-NNN-titulo.md`. Um agente não altera uma decisão arquitetural importante silenciosamente: identifique o problema → explique tecnicamente → proponha solução → avalie impacto → atualize a ADR/spec → implemente.

## Continuidade entre agentes/chats

Este projeto será trabalhado por múltiplos chats/agentes. **O repositório é a fonte de verdade, nunca a memória da conversa.**

Ao assumir o projeto, um agente novo deve:
1. Ler `PROJECT-CONTEXT.md` (seção "CURRENT PROJECT STATE").
2. Ler `CLAUDE.md` (este arquivo) e `AGENTS.md`.
3. Checar `git log` / `git status`.
4. Ler a spec em andamento em `specs/`.
5. Se houver uma spec em implementação, ler também seu `plan.md` e `tasks.md` antes de modificar código.
6. Verificar se os artefatos documentados correspondem ao estado real do repositório (`git status`, `git log` e estrutura dos arquivos).
7. Se houver inconsistência entre documentação e código, interromper a implementação e reportar a inconsistência antes de tomar uma decisão arquitetural.
8. Só então continuar o trabalho — sem recomeçar uma fase já concluída, sem duplicar implementação, sem mudar decisões arquiteturais sem justificativa.

Ao encerrar uma fase/spec relevante:
1. Rodar testes e corrigir problemas.
2. Revisar arquitetura e documentação.
3. Atualizar `PROJECT-CONTEXT.md` (estado atual, próximo passo, pendências, decisões).
4. Commitar.
5. Deixar explícito o próximo ponto de continuidade.


Preferir iniciar um novo chat ao começar uma fase importante nova, para não estourar contexto.
