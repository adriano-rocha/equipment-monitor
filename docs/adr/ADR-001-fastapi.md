# ADR-001 — Uso de FastAPI como framework de backend

## Status
Aceita

## Contexto
O sistema precisa de uma API REST + WebSocket, tipada, com boa integração a Pydantic para validação (REGRA 16) e alta produtividade para um time pequeno.

## Decisão
Usar FastAPI como framework HTTP/WebSocket do backend, com Pydantic para validação/serialização e injeção de dependência nativa para desacoplar camadas (rotas não devem conter regra de negócio — ver CLAUDE.md).

## Consequências
- Documentação OpenAPI automática, útil para o Windows Agent, Android App e Dashboard consumirem a API.
- Suporte nativo a WebSocket (Fase 05) sem framework adicional.
- Exige disciplina para não vazar lógica de negócio para dentro dos endpoints (rotas devem apenas orquestrar use cases).
