# SPEC: NPS e pergunta de esforço dentro do app

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (voz do cliente, ultra-admin)
**Relacionada:** [SPEC 112](112-feedback-no-banco-com-print-anotado.md) (feedback), [SPEC 113](113-avisos-do-ultra-admin-por-email.md) (avisos do ultra admin), pesquisa [profissionalizacao-saas-referencias](../../research/themes/profissionalizacao-saas-referencias.md)

## Problema

A opinião do cliente só chega quando ele procura o botão de feedback. Não há NPS nem medida de
atrito por fluxo, e o detrator só aparece quando cancela.

## Objetivo

Saber, por escritório e por fluxo, quem recomendaria o Pilar e onde ele é difícil, sem
incomodar quem usa, e falar com o detrator em até 48 h.

**Fora de escopo:** NPS por e-mail para quem quase não entra (fase 2), pesquisa por papel.

## Requisitos

1. **NPS:** card no canto, só no Início, depois de 20 s na tela; conta com 14 dias ou mais; no
   máximo uma vez a cada 90 dias por usuário (fechar conta como dispensa e respeita o
   intervalo). Nota de 0 a 10 e "o que mais pesou" opcional.
2. **Esforço (CES):** depois de lançar receita/despesa, criar proposta ou criar lead, um toast
   "Foi fácil fazer isso no Pilar?" com polegar para cima/baixo. Amostra de 1 em 5; no máximo uma
   vez a cada 30 dias por fluxo.
3. **Detrator (0 a 6)** avisa o ultra admin na hora, no sino e por e-mail, com a nota, o
   escritório e o comentário.
4. **Ultra admin → Satisfação:** NPS dos últimos 90 dias, respostas, detratores, dispensas, %
   de "fácil" por fluxo e os comentários.

Requisitos não-funcionais:

- **RLS:** usuário grava e lê só as próprias respostas (para o limite de frequência); ultra
  admin lê todas. Empresa vem do perfil por trigger.
- **Nunca atrapalha:** falha ao consultar ou gravar não mostra erro; o card não bloqueia a tela.
- **Marca:** sem emoji na UI (ícones de polegar).

## Critérios de aceite

- [x] Conta com menos de 14 dias, fora do Início ou com resposta nos últimos 90 dias não vê o NPS.
- [x] Fechar o card grava dispensa.
- [x] CES respeita a amostra e o intervalo por fluxo.
- [x] NPS calculado como % promotores menos % detratores.
- [ ] pgTAP: nota fora da faixa recusada, CES sem fluxo recusado, outro usuário não lê, ultra
      admin lê, detrator gera aviso.

## Dados e contratos

`pesquisas_satisfacao`: `tipo` (`nps|ces`), `nota`, `dispensou`, `comentario`, `fluxo`, `rota`,
`created_by`, `empresa_id`, `created_at`. Trigger `_pesquisa_avisar_detrator` chama
`notificar_ultra_admins` (tipo `nps_detrator`, link `/ultra-admin/satisfacao`).

## Decisões e riscos

- **Frequência calculada no app** a partir das linhas do próprio usuário: simples e sem RPC. Se
  a pessoa usar dois navegadores ao mesmo tempo, pode ver o NPS duas vezes no mesmo dia; aceito.
- **Início como momento:** é onde a pessoa já está olhando o resultado do escritório; trocar por
  "momento de sucesso" (proposta aceita) se a taxa de resposta for baixa.
