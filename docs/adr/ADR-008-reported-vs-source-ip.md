# ADR-008 — IP reportado pelo agente vs. IP observado pela infraestrutura

## Status

Aceita (criada na revisão de QA da Fase 01)

## Contexto

O contrato original do heartbeat previa um único campo `ip_address`, sem deixar claro se era o IP que o próprio agente informa (ex.: IP local da máquina, obtido via SO) ou o IP de origem observado pelo servidor na requisição HTTP. São coisas diferentes e com níveis de confiança diferentes: o primeiro é dado enviado pelo cliente (não confiável, pode estar errado, desatualizado ou, em tese, falsificado); o segundo é observado pela camada de rede/HTTP do próprio backend (mais confiável, mas pode ser um IP de proxy/NAT dependendo da infraestrutura de deploy).

## Decisão

Distinguir dois campos no registro de heartbeat:

- **`reported_ip`** (opcional, enviado no payload) — IP que o agente informa ter localmente. Tratado como **telemetria não confiável**, útil para diagnóstico (ex.: comparar com `source_ip` para detectar NAT/VPN), nunca usado para decisões de segurança.
- **`source_ip`** (obrigatório, preenchido pelo backend) — IP de origem autoritativo, obtido segundo a seguinte regra explícita, não pelo primeiro valor de qualquer header cegamente:

```
Sem proxy reverso confiável na frente da aplicação:
    source_ip = IP observado diretamente pela aplicação (ex.: request.client.host no FastAPI)

Com proxy reverso confiável (ex.: load balancer/ingress sob nosso controle):
    source_ip = IP original repassado pelo proxy (ex.: X-Forwarded-For),
                lido SOMENTE se a requisição vier de um proxy explicitamente
                cadastrado como confiável (lista de trusted proxies)
```

  `X-Forwarded-For` é um header que o próprio cliente pode enviar e manipular livremente; sem uma lista de proxies confiáveis que sobrescreva/valide o header antes de repassar, ele não pode ser tratado como autoritativo. "Autoritativo" aqui significa autoritativo **dentro da cadeia de infraestrutura confiável configurada**, nunca "o primeiro IP encontrado em um header HTTP" por padrão. A lista de proxies confiáveis (se houver) e o mecanismo de leitura do header são decisão de infraestrutura da Fase 02 — esta ADR apenas fixa a regra de confiança, para não ser implementada de forma ingênua depois.

Nenhum dos dois é usado para autenticação (isso é responsabilidade exclusiva da credencial `key_id`/`secret` — ADR-006). Ambos são armazenados no histórico de heartbeats (REGRA 07), não sobrescrevem um ao outro.

## Consequências

- `spec.md` da SPEC-001 referencia `reported_ip` (opcional, do payload) e `source_ip` (sempre preenchido pelo servidor), nunca um `ip_address` ambíguo.
- Não implementamos agora nenhuma lógica de alerta baseada em divergência entre os dois campos — apenas capturamos o dado. Uma regra de negócio futura (ex.: "alertar se IP mudar de país") pode consumir esse histórico sem exigir mudança de schema.