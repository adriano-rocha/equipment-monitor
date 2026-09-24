# ADR-006 — Identidade e autenticação de dispositivo

## Status
Aceita (revisada em QA da Fase 01 — substitui a versão anterior, que usava apenas um token secreto com hash)

## Contexto

A versão original desta ADR propunha um único `device_identifier` opaco, armazenado com hash, enviado em cada requisição. Na revisão de QA da Fase 01 identificamos um problema crítico: com apenas um segredo com hash, o backend não tem como localizar eficientemente **qual** dispositivo está fazendo a requisição sem comparar o segredo recebido contra o hash de todos os dispositivos cadastrados (não é possível indexar um hash para busca por igualdade de segredo em texto claro). Isso não escala e também dificulta revogação/rotação seletiva.

Também reforçamos duas restrições explícitas: o UUID interno (`id`) não deve ser tratado como segredo (é apenas chave primária, pode aparecer em logs/URLs internas), e o patrimônio (`asset_number`) nunca é credencial.

## Decisão

Separar **identificador público** de **segredo**, no padrão key/secret:

- `key_id` — identificador público do dispositivo, gerado na ativação (ex.: string aleatória curta, ex. 22 chars base62), **indexado e único**, enviado em cada requisição. Não é segredo — serve só para localizar o registro de credencial rapidamente. Nunca é o `id` (UUID) nem o `asset_number`.
- `secret` — segredo gerado na ativação, mostrado/entregue ao agente **uma única vez** no momento da ativação, nunca reexibido depois. O backend armazena apenas `secret_hash` (hash forte, ex. argon2), nunca o segredo em claro.
- Tabela/entidade `device_credentials` (relação 1:N com `devices`, embora no MVP haja tipicamente uma credencial ativa por device):
  - `id` (PK própria da credencial)
  - `device_id` (FK)
  - `key_id` (único, indexado)
  - `secret_hash`
  - `status`: `ACTIVE` | `REVOKED`
  - `created_at`, `revoked_at` (nullable), `last_used_at` (nullable)

**Fluxo de autenticação:**
1. Agente envia `key_id` e `secret` (ex.: header `Authorization: DeviceKey <key_id>:<secret>`, formato exato a definir na Fase 02).
2. Backend busca `device_credentials` por `key_id` (lookup indexado, O(1)/O(log n) — não varre a tabela).
3. Se não encontrado ou `status != ACTIVE` → 401.
4. Verifica `secret` contra `secret_hash`. Se inválido → 401.
5. Resolve o `Device` associado e **retorna essa entidade já carregada** para a camada de aplicação (ver ADR sobre fluxo de autenticação em `plan.md` da SPEC-001) — evitando um segundo lookup redundante do mesmo device no use case.
6. Atualiza `last_used_at` da credencial (não confundir com `devices.last_seen`, que é atualizado pelo heartbeat em si). `last_used_at` não faz parte da regra de consistência do heartbeat (ADR-003) — a estratégia de quando/como essa escrita se relaciona com a transação do heartbeat (mesma transação vs. transação separada) é decisão de implementação, definida explicitamente no `plan.md` da SPEC-001, para não ficar implícita no código.

**Revogação e rotação (desenhadas agora, implementação pode ficar para spec futura de gestão de credenciais):**
- Revogar = marcar `status = REVOKED` (+ `revoked_at`). Credencial revogada nunca mais autentica.
- Rotacionar = criar uma nova credencial (`ACTIVE`) e revogar a antiga — não há "update" de segredo em uma credencial existente, para manter histórico auditável.
- Um device pode ter múltiplas credenciais ao longo do tempo (histórico), mas o desenho assume no máximo uma `ACTIVE` por vez no MVP (não impomos essa restrição no banco ainda; validação fica na regra de negócio/aplicação, documentada aqui para a Fase 02).

Usuários humanos (dashboard) continuam autenticando via JWT (login com email/senha) — isso não muda. Dispositivos **nunca** usam JWT de usuário.

## Consequências
- SPEC-001 assume que já existe uma credencial `ACTIVE` válida (o fluxo de ativação/emissão em si é spec futura, fora de escopo).
- O contrato de autenticação passa a exigir dois valores (`key_id` + `secret`), não um único token — isso é refletido em `spec.md`/`plan.md` da SPEC-001.
- Fica arquiteturalmente pronto para revogação e rotação sem redesenho, mesmo que a Fase 02 implemente apenas o caminho feliz (autenticar) e deixe revogação/rotação para uma spec dedicada de gestão de credenciais.
