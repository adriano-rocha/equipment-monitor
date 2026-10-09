# PLAN-009 — Segurança Dell

## 1. Decisão

Manter a arquitetura atual do Equipment Monitor e utilizar os recursos nativos do Windows, Microsoft e Dell.

Não foi identificada necessidade comprovada de adicionar código próprio de segurança.

## 2. Resultado da revisão

O Equipment Monitor permanece responsável pelo inventário, identidade, eventos, responsáveis, heartbeat, estado de comunicação e alertas.

BitLocker, TPM, Secure Boot, BIOS/UEFI e recuperação permanecem sob responsabilidade das ferramentas e configurações nativas aplicáveis.

## 3. Teste de comunicação

O agente Windows foi executado no ASUS de teste. O backend recebeu os dados do dispositivo `NB-PILOTO-001`, com endereço reportado `192.168.15.60` e estado `ONLINE`.

Esse teste valida a comunicação do agente, não os recursos de segurança Dell.

## 4. Pendências técnicas

A validação de TPM, Secure Boot, BitLocker, BIOS/UEFI e recuperação em hardware Dell depende de acesso a um equipamento desse fabricante.

Nenhuma configuração de firmware foi alterada.

## 5. Conclusão

A revisão arquitetural foi concluída. A decisão atual é não alterar o código.

A fase poderá ser encerrada documentalmente com a limitação de hardware registrada, mantendo os testes específicos Dell pendentes.
