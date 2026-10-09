# SPEC-009 — Segurança Dell

## 1. Objetivo

Definir a estratégia de segurança dos notebooks Dell Windows utilizados pelo Equipment Monitor, priorizando os recursos nativos do Windows e do fabricante.

## 2. Decisão arquitetural

A revisão definiu que o Equipment Monitor continuará responsável por:

* Patrimônio e identidade do dispositivo.
* Eventos e responsáveis.
* Heartbeat e estado de comunicação.
* Histórico e alertas operacionais.

A proteção do sistema operacional, criptografia, firmware e recuperação continuará sob responsabilidade dos recursos nativos do Windows, Microsoft e Dell.

**Decisão: nenhuma alteração de código nesta fase**, pois não foi identificada necessidade comprovada de implementar recursos próprios de segurança.

## 3. Princípios de segurança

* `OFFLINE` significa ausência de comunicação, não roubo.
* Não implementar antivírus, EDR ou MDM próprios.
* Não coletar arquivos pessoais, senhas, teclas digitadas ou capturas de tela.
* Não alterar automaticamente BIOS/UEFI.
* Não armazenar chaves de recuperação do BitLocker no Equipment Monitor sem necessidade formal.
* Priorizar os mecanismos nativos disponíveis.

## 4. Validações realizadas

* O agente Windows foi executado no ASUS de teste.
* O backend recebeu dados do equipamento.
* O dispositivo `NB-PILOTO-001` apareceu como `ONLINE`.
* O heartbeat e a comunicação com o dashboard foram confirmados.

Esses resultados validam a comunicação do agente, mas não comprovam a segurança específica de notebooks Dell.

## 5. Validações pendentes

Aguardam acesso a um notebook Dell:

* TPM e versão.
* Secure Boot.
* BitLocker e proteção do volume.
* BIOS/UEFI e proteções de firmware.
* Recursos nativos de recuperação.
* Recursos específicos do modelo Dell.

## 6. Resultado

A arquitetura atual será mantida sem implementação adicional de segurança nesta fase.

A validação específica do hardware Dell permanece pendente e deverá ser realizada antes de afirmar que todos os critérios técnicos de segurança foram atendidos.
