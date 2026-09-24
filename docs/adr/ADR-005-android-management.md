# ADR-005 — Não recriar funcionalidades nativas do ecossistema Google/Android

## Status
Aceita

## Contexto
Google/Android já oferecem Find Hub, Lost Mode, Android Management API, etc. Construir uma solução própria equivalente seria redundante e mais frágil.

## Decisão
Na Fase 08, investigar e validar (em dispositivos reais quando possível) os recursos nativos antes de qualquer decisão de construir algo próprio ou adquirir hardware tracker (Fase 10). Produzir uma matriz de validação (capacidade × modelo × condição × resultado). Nunca declarar um recurso como garantido apenas por estar documentado pelo Google — depende de modelo, versão de Android, gerenciamento corporativo, permissões e conectividade.

## Consequências
- Fase 10 (hardware tracker) só pode iniciar após a Fase 08 estar concluída e documentada.
- Equipment Monitor foca em heartbeat/monitoramento próprio; localização avançada e recuperação remota são tratadas como camada complementar, não substituída.
