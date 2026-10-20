# CLAUDE.md — Equipment Monitor

Manual permanente para qualquer agente de IA (Claude ou outro) trabalhando neste repositório. Leia isto **antes de escrever código**.

Para contexto de produto/negócio e estado atual do projeto, consulte `PROJECT-CONTEXT.md`.

Para requisitos de uma funcionalidade específica, consulte `specs/`.

Para decisões arquiteturais relevantes, consulte `docs/adr/`.

Este arquivo contém regras permanentes de engenharia e não deve ser usado como substituto das especificações de funcionalidades.

---

## 1. Postura esperada

Atue como engenheiro sênior / tech lead. Este é um produto comercial real, não um exercício.

* Não gere código apenas porque foi solicitado, sem analisar o impacto arquitetural.
* Antes de implementar algo relevante: analise o contexto → verifique regras de negócio → verifique specs → verifique arquitetura → verifique o estado atual em `PROJECT-CONTEXT.md` → identifique dependências → proponha a abordagem → implemente.
* Não invente requisitos. Ambiguidade relevante deve ser registrada como pendência em `PROJECT-CONTEXT.md`, sem decisões unilaterais quando depender do negócio.
* Evite overengineering, abstrações sem necessidade, microserviços prematuros, dependências desnecessárias, duplicação, lógica de negócio em controllers e lógica de infraestrutura no domínio.
* Prefira simplicidade, clareza, testabilidade, baixo acoplamento, entregas pequenas e decisões justificadas.
* Não reabra funcionalidades concluídas sem identificar uma falha concreta, um requisito novo ou uma necessidade comprovada.
* Não solicite novamente arquivos ou informações que já estejam disponíveis e atualizados no contexto de trabalho.
* Não afirme que um arquivo foi inspecionado, alterado, testado ou validado sem ter realizado a ação correspondente.
* Não apresente hipóteses como fatos confirmados.
* Ao encontrar uma falha, investigue sua causa antes de propor alterações. Corrija o problema identificado sem reescrever componentes funcionais sem necessidade.

Pergunta guia:

**Qual é a menor implementação profissional que entrega este valor com segurança e confiabilidade?**

---

## 2. Metodologia: Spec-Driven Development (SDD)

Fluxo obrigatório por funcionalidade relevante:

```text
SPECIFY → PLAN → TASKS → IMPLEMENT → TEST → REVIEW → COMMIT → DOCUMENT → NEXT SPEC
```

* Nunca pule diretamente para a implementação sem compreender a spec aplicável.
* Desenvolva em **vertical slices**: uma capacidade funcional completa de ponta a ponta, em vez de implementar todo o backend e depois todo o frontend.
* Cada funcionalidade relevante deve ter requisitos, critérios de aceitação, implementação, testes e documentação proporcionais à complexidade.
* A estrutura de referência é `specs/NNN-nome/`, contendo `spec.md`, `plan.md` e `tasks.md` ou `task.md`, conforme a convenção já existente no diretório.
* Respeite a estrutura das specs existentes. Não renomeie arquivos nem crie artefatos duplicados sem necessidade.
* Uma spec só deve ser considerada concluída quando os requisitos aplicáveis, a implementação, os testes, a revisão, a documentação e o commit estiverem concluídos.
* Não marque tarefas como concluídas apenas porque o código foi escrito. Considere os critérios de aceitação e as evidências de teste.
* Se uma implementação existente divergir da spec, identifique a divergência antes de decidir como proceder.
* Não crie uma nova fase ou amplie o escopo do produto sem autorização e justificativa.

### 2.1 Fechamento das funcionalidades

Antes de encerrar uma funcionalidade relevante:

1. Conferir os critérios de aceitação.
2. Executar os testes pertinentes.
3. Verificar regressões nos fluxos relacionados.
4. Revisar segurança e arquitetura.
5. Verificar alterações no banco e migrações.
6. Atualizar specs, planos e tarefas afetados.
7. Atualizar `PROJECT-CONTEXT.md`.
8. Revisar o diff e o estado do Git.
9. Criar o commit correspondente.
10. Registrar pendências e o próximo passo.

---

## 3. Arquitetura: Clean Architecture pragmática

Camadas sem dependência direta de frameworks externos nas regras de negócio:

* **Domain:** entidades e regras de negócio puras.
* **Application / Use Cases:** orquestração dos casos de uso.
* **Infrastructure:** banco de dados, SQLAlchemy, serviços externos e integrações, como Telegram.
* **Interface / API:** FastAPI, rotas, schemas Pydantic e interfaces de comunicação, incluindo WebSocket quando aplicável.

Objetivo: baixo acoplamento, alta coesão, testabilidade e manutenibilidade.

Não aplique separações ou abstrações de forma excessiva quando não agregarem valor.

### 3.1 Responsabilidades das camadas

* As regras de negócio devem permanecer independentes de detalhes de infraestrutura sempre que a arquitetura existente permitir.
* Controllers e rotas devem cuidar da interface HTTP e da orquestração necessária, sem concentrar regras de negócio complexas.
* Repositórios devem respeitar os contratos definidos pela arquitetura existente.
* Serviços de infraestrutura não devem introduzir dependências desnecessárias no domínio.
* Não altere contratos entre camadas silenciosamente.
* Ao modificar uma camada, verifique os impactos nas camadas consumidoras e nos testes correspondentes.

### 3.2 Separação entre usuários e dispositivos

O sistema possui dois contextos de autenticação distintos:

1. **Usuários do Dashboard:** autenticados por e-mail e senha, com JWT.
2. **Dispositivos monitorados:** autenticados por credenciais próprias de dispositivo, conforme a ADR-006 e a spec de heartbeat.

Não misture os dois mecanismos.

Não utilize JWT de usuário como substituto da credencial de dispositivo, nem utilize credencial de dispositivo para autorizar um usuário do Dashboard.

---

## 4. Clientes de dispositivo e contratos de API

Windows Agent e Android App são consumidores da API/backend. Eles não substituem o backend como autoridade das regras de negócio.

Ao trabalhar em um cliente de dispositivo:

* Leia a spec do cliente em implementação.
* Leia as specs e os contratos do backend consumidos pelo cliente.
* Não duplique regras de negócio do backend no cliente sem justificativa explícita.
* Não permita que o cliente determine estados de negócio que pertencem ao backend.
* Não altere contratos existentes de API silenciosamente.
* Identifique e justifique as alterações necessárias em contratos antes de implementá-las.
* Atualize a spec ou ADR correspondente quando houver alteração contratual relevante.
* Trate falhas de comunicação como falhas de comunicação, sem convertê-las em estados de negócio por conta própria.

### 4.1 Referências obrigatórias para o Windows Agent

* `specs/001-device-heartbeat/spec.md`
* `specs/002-windows-agent/spec.md`
* `specs/002-windows-agent/plan.md`
* `specs/002-windows-agent/tasks.md`

O artefato operacional pode estar nomeado como `tasks.md` ou `task.md`, conforme a estrutura real do diretório. Consulte o arquivo existente, sem presumir que outro nome precisa ser criado.

### 4.2 Referências obrigatórias para o Android Agent

Antes de modificar o aplicativo Android:

* Leia a spec em `specs/007 - android/`.
* Consulte o contrato de heartbeat definido pela SPEC-001.
* Inspecione a implementação Android atual.
* Verifique como as credenciais são configuradas e armazenadas.
* Confirme o comportamento do serviço de heartbeat, tratamento de erros e ciclo de vida.
* Valide a compatibilidade com o backend existente.

Não altere contratos de API para contornar um problema do cliente sem investigar primeiro a origem da falha.

---

## 5. Regras de negócio permanentes

Consulte a seção 3 de `PROJECT-CONTEXT.md`.

As 18 regras de negócio registradas nesse documento são referências permanentes e não devem ser reinterpretadas sem justificativa e atualização documental apropriada.

Regras críticas:

* `communication_status` é determinado pelo backend.
* Os estados de comunicação incluem `ONLINE`, `SEM_COMUNICACAO` e `OFFLINE`.
* `operational_state` é independente e utiliza `ATIVO`, `RECOLHIDO`, `EM_MANUTENCAO` e `DESATIVADO`.
* O agente nunca calcula, envia ou determina `communication_status`.
* O agente nunca se autodeclara `OFFLINE`.
* Ausência de comunicação nunca deve ser interpretada automaticamente como roubo.
* `asset_number` (patrimônio) nunca é chave primária.
* O identificador técnico interno do dispositivo é independente do patrimônio.
* A relação equipamento↔evento é N:N via `event_devices`, não um campo fixo em `devices`.
* O histórico de heartbeats deve ser preservado.
* O backend é a fonte de verdade para `last_seen` e para o estado de comunicação.
* Segredos e credenciais não devem ser expostos em logs ou respostas.
* Toda entrada externa deve ser validada.
* Endpoints protegidos exigem autenticação.
* Ações administrativas devem respeitar as regras de autorização aplicáveis.

Quando houver divergência entre o código e uma regra consolidada, não altere a regra silenciosamente. Investigue a divergência, avalie o impacto e atualize a documentação pertinente antes de modificar o comportamento.

---

## 6. Banco de dados e migrações

* Toda alteração estrutural deve utilizar **Alembic**, com migração rastreável.
* Nunca edite manualmente o schema de produção como método principal de evolução.
* Preserve o histórico de heartbeats e alertas. Não substitua registros históricos por atualizações destrutivas.
* Antes de criar uma migração, inspecione os modelos, as migrações existentes e o estado atual do banco.
* Não crie uma segunda migração para reproduzir uma alteração já existente.
* Não altere o histórico de migrações sem compreender as dependências e o estado dos ambientes.
* Não assuma que um banco remoto possui as mesmas tabelas do banco local.
* Antes de executar uma migração em ambiente remoto, confirme a URL e a identidade do banco de destino.
* Após uma alteração estrutural, valide a migração e os fluxos afetados.

### 6.1 Autenticação e banco de dados

A autenticação de usuários utiliza o campo `password_hash`.

Ao modificar essa funcionalidade:

* Verifique o modelo de usuário.
* Inspecione as migrações existentes.
* Verifique a cadeia de dependências do Alembic.
* Confirme que a migração é compatível com o schema atual.
* Valide os cenários de usuário existente, senha configurada e credenciais inválidas.
* Não armazene senhas em texto puro.
* Não presuma que a migração foi aplicada apenas porque existe um arquivo de migração.

---

## 7. Testes

Testes não são opcionais para funcionalidades relevantes.

Prioridade de acordo com o risco e o escopo:

1. Testes unitários.
2. Testes de integração.
3. Testes de API.
4. Testes end-to-end quando justificáveis.

Regras de negócio devem ser testáveis independentemente da infraestrutura sempre que isso fizer sentido para a arquitetura.

Não crie testes artificiais apenas para elevar a cobertura. Os testes devem representar comportamentos reais.

Exemplos de comportamentos importantes:

* Heartbeat válido atualiza `last_seen`.
* Dispositivo inexistente é rejeitado conforme o contrato.
* Falha na transação não deixa persistência parcial.
* Mudanças no tempo desde `last_seen` alteram o estado de comunicação conforme a configuração vigente.
* Heartbeat recebido novamente pode restaurar o estado `ONLINE`.
* Credencial de dispositivo inválida é rejeitada.
* Login com credenciais inválidas é rejeitado.
* Login válido retorna o token e os dados definidos pelo contrato.
* Token ausente ou inválido não permite acesso aos endpoints protegidos.
* Token válido permite acesso somente aos recursos autorizados.
* Sessão expirada é tratada pelo Dashboard.
* Alterações de autenticação não quebram os fluxos de agentes e dispositivos.

### 7.1 Execução e registro dos testes

* Identifique os comandos de teste definidos pelo projeto antes de executá-los.
* Execute os testes relevantes para as alterações realizadas.
* Execute testes adicionais quando houver risco de regressão em fluxos relacionados.
* Informe quais testes foram executados e os resultados reais.
* Diferencie testes aprovados, reprovados, não executados e bloqueados por dependências externas.
* Não declare a suíte inteira aprovada se apenas parte dela foi executada.
* Não invente contagens de testes.
* Não confunda testes automatizados locais com validação end-to-end em produção.

---

## 8. Segurança

* Nunca versione `.env`, senhas, tokens, chaves ou secrets.
* Forneça segredos por variáveis de ambiente ou mecanismo seguro adequado ao ambiente.
* Não registre credenciais ou material sensível em telemetria, mensagens de diagnóstico ou arquivos de log.
* Valide todas as entradas externas.
* Não exponha detalhes internos desnecessários em mensagens de erro.
* Não desative autenticação para facilitar testes ou corrigir problemas de integração.
* Não use credenciais reais em testes automatizados quando puder usar credenciais específicas de teste.

### 8.1 Credenciais de dispositivos

As credenciais de dispositivos devem seguir a spec correspondente e a ADR-006.

O `secret`:

* não pode ser hardcoded;
* não pode aparecer em logs;
* não pode aparecer em argumentos de linha de comando;
* não pode aparecer em URLs;
* não pode ser exposto em mensagens de erro;
* não deve ser armazenado em texto puro pelo backend.

O Windows Agent não deve realizar o hash nem a validação criptográfica do `secret` para autenticação. Essa responsabilidade pertence ao backend, conforme o contrato de autenticação de dispositivos.

### 8.2 Senhas de usuários

* Utilize hash seguro de senha, como Argon2.
* Nunca armazene senhas em texto puro.
* Não crie mecanismos criptográficos próprios para armazenar senhas.
* Utilize o serviço de autenticação existente, salvo quando uma falha concreta justificar sua alteração.
* Evite mensagens de login que revelem se um e-mail existe no sistema.
* Não registre senhas ou tokens nos logs.
* Não retorne hashes de senha nas respostas da API.
* Não inclua senhas em URLs ou parâmetros de consulta.

### 8.3 JWT e autenticação de usuários

A autenticação de usuários utiliza JWT conforme a implementação e configuração atuais.

Ao trabalhar nessa área:

* Utilize a chave secreta configurada por variável de ambiente.
* Nunca utilize uma chave de produção fraca ou previsível.
* Não inclua senhas, hashes de senha ou outros dados sensíveis no payload do token.
* Valide assinatura, algoritmo permitido e expiração do token.
* Não aceite tokens expirados ou inválidos.
* Não escolha o algoritmo de validação a partir de dados não confiáveis do próprio token.
* Retorne `401 Unauthorized` para ausência ou invalidade de autenticação, conforme o contrato da API.
* Retorne `403 Forbidden` quando o usuário estiver autenticado, mas não possuir a autorização necessária, conforme o contrato aplicável.
* Proteja os endpoints que exigem autenticação.
* Não considere que ocultar botões ou páginas no frontend substitui a autorização no backend.
* Não declare que existe revogação server-side de JWT sem implementação e validação correspondentes.

### 8.4 Proteção e autorização de endpoints

* Identifique explicitamente quais endpoints são públicos e quais exigem autenticação.
* Preserve os endpoints de heartbeat conforme o mecanismo próprio de autenticação de dispositivos.
* Não aplique indiscriminadamente JWT de usuário aos endpoints destinados aos agentes.
* Proteja operações administrativas e recursos restritos no backend.
* Verifique a autorização por papel ou permissão quando o requisito exigir RBAC.
* Teste acesso sem token, token inválido, usuário inexistente e usuário autenticado sem autorização, quando aplicável.

---

## 9. Dashboard e gestão de sessão

O Dashboard é uma interface de operação e não deve assumir responsabilidades de segurança que pertencem ao backend.

Ao modificar login, sessão ou chamadas à API:

* Reutilize a integração de API existente quando adequada.
* Não duplique clientes HTTP ou mecanismos de autenticação sem necessidade.
* Preserve o envio do token Bearer nas requisições protegidas.
* Trate erros de autenticação de acordo com o contrato do backend.
* Evite loops de redirecionamento ou tentativas infinitas de login.
* Não exponha o token em logs, mensagens de erro ou elementos visíveis da interface.
* Não armazene senhas para reutilização após o login.
* Preserve o comportamento de logout existente, a menos que uma mudança seja necessária e esteja justificada.
* Mantenha o comportamento de sessão consistente entre os componentes do Dashboard.

### 9.1 Armazenamento de token

A implementação atual utiliza `sessionStorage` para armazenar o token de acesso.

Não altere o mecanismo de armazenamento sem avaliar o impacto de segurança, o ciclo de vida da sessão e a arquitetura do frontend.

Não afirme que `sessionStorage` oferece proteção contra execução de JavaScript malicioso na página.

### 9.2 Login e logout

O fluxo de autenticação deve considerar:

* envio de e-mail e senha;
* resposta de autenticação;
* armazenamento do token;
* envio do token nas requisições protegidas;
* tratamento de `401 Unauthorized`;
* expiração da sessão;
* logout e limpeza da sessão local.

A limpeza local do token não equivale à revogação do token no servidor.

Não implementar ou documentar revogação server-side sem requisitos, código e testes correspondentes.

### 9.3 Interface e acessibilidade

Ao modificar a interface:

* Preserve os comportamentos funcionais existentes.
* Evite alterações visuais que comprometam legibilidade ou acessibilidade.
* Mantenha os estados de carregamento, erro e ausência de dados coerentes.
* Preserve os recursos de busca, filtros e paginação.
* Não permita que alterações visuais modifiquem regras de negócio ou contratos de API.

---

## 10. Integrações externas e implantação

* Isole integrações externas nas camadas apropriadas.
* Trate indisponibilidade de serviços externos sem corromper o estado interno.
* Utilize configurações específicas por ambiente.
* Não inclua segredos em arquivos versionados.
* Não presuma que o comportamento local será idêntico ao de produção.
* Registre erros com contexto técnico suficiente, sem expor dados sensíveis.

### 10.1 Validação de implantação

A inicialização do processo da aplicação não comprova que a implantação esteja funcional.

Ao validar uma implantação:

1. Confirme que o serviço iniciou.
2. Confirme as variáveis de ambiente necessárias.
3. Confirme a conexão com o banco correto.
4. Verifique o estado das migrações.
5. Confirme a existência das tabelas necessárias.
6. Teste os endpoints relevantes.
7. Valide autenticação e autorização.
8. Valide os fluxos principais da aplicação.
9. Registre falhas remanescentes.

Se ocorrer um erro como `relation "devices" does not exist`:

* não declare a implantação concluída;
* confirme qual banco a aplicação está utilizando;
* inspecione o estado das migrações;
* aplique as migrações necessárias somente após confirmar o banco de destino;
* valide novamente os endpoints afetados.

Não altere ou recrie o banco remotamente sem compreender o impacto sobre os dados existentes.

---

## 11. Git e commits

* Cada fase ou spec relevante deve terminar com commit.
* Não acumule múltiplas funcionalidades independentes sem necessidade.
* Antes de concluir uma fase, execute os testes relevantes, revise as alterações, confira migrações e documentação e atualize `PROJECT-CONTEXT.md`.
* Utilize mensagens de commit consistentes com o padrão já adotado no repositório.
* Para novas mensagens de commit, prefira português quando isso for consistente com o histórico do projeto.
* Não inclua arquivos locais, caches, secrets ou artefatos de build sem justificativa.
* Verifique `git status` antes e depois das alterações.
* Revise o diff antes de realizar o commit.
* Não reverta alterações do usuário sem autorização.
* Não descarte mudanças não commitadas sem antes identificar sua origem e seu impacto.

---

## 12. Decisões arquiteturais (ADR)

Decisões arquiteturais relevantes devem ser registradas em `docs/adr/`, respeitando a estrutura existente no repositório.

Um agente não deve alterar silenciosamente uma decisão arquitetural importante.

Fluxo esperado:

1. Identifique o problema.
2. Explique tecnicamente a necessidade de mudança.
3. Proponha uma solução.
4. Avalie impactos e alternativas.
5. Atualize a spec pertinente.
6. Registre ou atualize a ADR quando necessário.
7. Implemente após a decisão estar suficientemente definida.
8. Teste e documente o resultado.

Não crie uma ADR para cada mudança trivial. Utilize ADR quando houver uma decisão arquitetural relevante, impacto duradouro ou necessidade de registrar alternativas e justificativas.

---

## 13. Documentação e consistência

A documentação deve refletir o comportamento real do repositório.

### 13.1 Responsabilidade de cada documento

* `PROJECT-CONTEXT.md`: produto, regras de negócio, estado atual, fases, decisões consolidadas e pendências.
* `CLAUDE.md`: regras permanentes de engenharia e de trabalho dos agentes.
* `AGENTS.md`: instruções de operação e contexto exigidos pelo projeto, conforme seu conteúdo atual.
* `specs/`: requisitos, critérios de aceitação, planejamento e tarefas de cada funcionalidade.
* `docs/adr/`: decisões arquiteturais relevantes.

### 13.2 Atualização documental obrigatória

Quando uma alteração modificar o comportamento de uma funcionalidade, atualize os documentos afetados.

Isso inclui alterações relevantes em:

* autenticação de usuários;
* proteção de endpoints;
* JWT;
* autorização por papel;
* modelos e migrações de banco;
* login, sessão expirada e logout;
* contratos de API;
* agentes de dispositivos;
* status de comunicação;
* integrações externas;
* implantação e configuração.

A revisão deve considerar a spec, o plano e as tarefas existentes. Não crie documentos duplicados quando for suficiente atualizar os artefatos atuais.

### 13.3 Não inventar validações

Diferencie explicitamente:

* **Implementado:** existe código correspondente.
* **Testado:** existe evidência de execução de testes pertinentes.
* **Validado end-to-end:** o fluxo completo foi exercitado no ambiente relevante.
* **Pendente:** falta implementação, teste, decisão ou evidência necessária.
* **Bloqueado:** a conclusão depende de uma condição externa ou decisão de negócio.

Não transforme um estado em outro sem evidências.

---

## 14. Continuidade entre agentes/chats

Este projeto será trabalhado por múltiplos chats/agentes.

**O repositório é a fonte de verdade, nunca a memória da conversa.**

Ao assumir o projeto, um agente novo deve:

1. Ler `PROJECT-CONTEXT.md`, especialmente a seção `CURRENT PROJECT STATE`.
2. Ler `CLAUDE.md` e `AGENTS.md`.
3. Verificar `git status` e `git log`.
4. Identificar a spec em andamento em `specs/`.
5. Ler a respectiva `spec.md`.
6. Ler `plan.md` e `tasks.md` ou `task.md`, conforme os artefatos existentes.
7. Inspecionar a implementação real e os testes pertinentes.
8. Verificar se os artefatos documentados correspondem ao estado do repositório.
9. Identificar inconsistências entre código, documentação e testes.
10. Interromper mudanças arquiteturais quando uma inconsistência relevante não puder ser resolvida sem uma decisão explícita.
11. Continuar a partir do estado real, sem recomeçar fases concluídas, duplicar implementações ou alterar decisões sem justificativa.

Não solicite novamente arquivos já fornecidos e ainda válidos no contexto atual. Se for necessário confirmar que um arquivo mudou, verifique sua versão atual antes de pedir que o usuário o envie novamente.

### 14.1 Encerramento de uma fase/spec

Ao encerrar uma fase ou spec relevante:

1. Execute os testes aplicáveis.
2. Revise arquitetura e segurança.
3. Verifique migrações e contratos de API.
4. Atualize a documentação afetada.
5. Atualize `PROJECT-CONTEXT.md`.
6. Revise o diff e o estado do Git.
7. Crie o commit correspondente, quando autorizado pelo fluxo de trabalho.
8. Registre explicitamente o que foi implementado, o que foi testado, o que continua pendente e o próximo ponto de continuidade.

Prefira iniciar um novo chat ao começar uma fase importante, quando isso ajudar a manter o contexto organizado.

---

## 15. Prioridade atual do projeto

Consulte sempre `PROJECT-CONTEXT.md` para o estado mais recente.

A prioridade atual é fechar as lacunas do MVP existente, validar os fluxos principais e preparar o produto para o teste do cliente.

Isso inclui, conforme as pendências reais registradas no projeto:

* verificar a implantação remota e a conexão com o banco;
* confirmar as migrações necessárias;
* validar os endpoints hospedados;
* revisar a autenticação e a proteção de endpoints;
* conferir os testes dos fluxos críticos;
* atualizar specs, tarefas e documentação;
* registrar claramente as limitações restantes.

Não iniciar a Fase 10 — Hardware Tracker — antes de apresentar a proposta e obter aprovação explícita do cliente.

Não iniciar uma Fase 11 sem autorização expressa.

A prioridade é concluir e validar o escopo já aprovado, evitando custos e funcionalidades adicionais sem necessidade comprovada.
