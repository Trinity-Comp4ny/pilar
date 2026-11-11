# SPEC: Prévia de recursos e bug zero com prazo

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (produto, ultra-admin)
**Relacionada:** [SPEC 145](145-feedback-fecha-pela-pr.md) (feedback fecha pela PR), [SPEC 152](152-o-que-mudou-e-voce-pediu-entregamos.md) (você pediu, entregamos), pesquisa [profissionalizacao-saas-referencias](../../research/themes/profissionalizacao-saas-referencias.md) (GitHub Feature preview, Linear zero-bug policy)

## Problema

1. Recurso novo só vai para todo mundo de uma vez. O design partner não tem como testar antes
   e opinar, e mudança grande assusta quem não pediu.
2. Bug relatado não tem prazo: fica na fila sem dono do tempo.

## Objetivo

Quem quer testa o recurso novo antes, com feedback e volta à versão atual; e nenhum bug
relatado passa de 7 dias aberto sem alguém ver.

## Requisitos

### Prévia de recursos

1. O ultra admin cadastra o recurso em prévia (`/ultra-admin/previas`): chave, nome e o que
   muda. Desligar tira do catálogo e de todo mundo.
2. Em Configurações → Conta, "Prévia de recursos" lista os ativos com uma chave liga/desliga e
   "Contar o que achou" (feedback com o nome da prévia). Sem prévia ativa, o card não aparece.
3. O código do recurso mostra a novidade só quando `usePrevia("<chave>")` é verdadeiro.

### Bug zero com prazo

4. No Feedback do Ultra admin, todo problema em aberto mostra o prazo: 7 dias corridos a partir
   do envio ("5 d", "Atrasado 2 d"); sugestão não tem prazo.
5. Filtro "Bugs com mais de 7 dias" com a contagem. A meta é zero no fim de cada mês.
6. Ritual semanal de polimento (`docs/operations/BUG_ZERO_E_POLIMENTO.md`).

## Critérios de aceite

- [x] Usuário vê só prévias ativas, liga e desliga só para si; não vê a escolha dos outros.
- [x] Bug em aberto com 9 dias aparece como atrasado e no filtro; resolvido e sugestão não.
- [ ] pgTAP da prévia.

## Decisões e riscos

- **Prazo único de 7 dias:** o feedback não tem gravidade hoje. Quando o triador marcar "trava o
  trabalho", entra o prazo de 48 h (Linear) como segunda faixa.
- **Prévia sem recurso hoje:** o mecanismo sai pronto; o primeiro recurso a usar decide se fica.
