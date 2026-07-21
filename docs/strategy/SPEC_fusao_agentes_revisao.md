# Spec — Fundir Revisão IA na tela Agentes

Status: em implementação (Fase 1)
Data: 2026-07-21
Decisão do time: Produto + Crítico + ICP + UX (discussão registrada nesta sessão)

## Problema

Hoje há duas telas separadas para a IA:

- **Agentes** (`/agentes`): chat conversacional. Ações viram card de confirmação
  inline, aprovado na hora. Estado efêmero (localStorage).
- **Revisão IA** (`/revisao-ia`): fila persistente de `agent_runs` em
  `pending_review`, aguardando aprovação humana. Só o `ai-proposta-copilot`
  (`orcamento_honorarios`) alimenta de verdade. Só owner acessa (`RequireRole`).

Dois problemas reais, verificados no código:

1. `useAgentInbox` (`useAgentRuns.ts`) lista todo `pending_review` **sem filtrar
   `agent_type`**. Drafts do chat que o usuário não confirma nem cancela vazam
   pra Revisão IA e caem no ramo "Draft em formato não reconhecido".
2. Item de sidebar duplicado ("Agentes" + "Revisão IA"), ambos com badge "novo".

## Decisão

Fundir a fila de Revisão dentro do módulo **Agentes** como uma **aba**
(segmented control "Conversa | Revisão"), não como stream fundido nem split
permanente. Motivos:

- O ICP separa mentalmente "conversar com a IA" (reflexo) de "aprovar orçamento"
  (ritual). Cards de aprovação soltos no meio da conversa viram palheiro com 8
  orçamentos. A aba dedicada preserva a lista limpa e empilhada.
- O chat é full-bleed agent-first; o rail vertical do `SecondSidebar`
  espremeria a conversa. Segmented control no header perturba menos.
- "Agentes detectam pendências sozinhos e criam cards" NÃO existe (não há
  trigger/cron; todo run nasce de ação explícita). Fica fora do escopo até
  depois do primeiro pagante.

## Fase 1 (esta entrega) — fusão + faxina

1. Filtrar `useAgentInbox` por `agent_type = 'orcamento_honorarios'` (mata o
   vazamento de drafts do chat na fila).
2. Extrair o corpo da Revisão IA num componente `RevisaoInbox` reusável.
3. Tela Agentes ganha aba "Conversa | Revisão (N)" no header, com badge de
   contagem. Aba Revisão renderiza `RevisaoInbox`.
4. **Preservar o gate de owner**: a aba Revisão só aparece/consulta para owner
   (papéis do contrato) ou papéis legados. Não regredir ACH-ADM-01.
5. Remover "Revisão IA" da sidebar; `/revisao-ia` redireciona para
   `/agentes?tab=revisao`.

Não toca: `useChat`, os cards de confirmação, a renderização de mensagens, os
RPCs de gate. Nenhuma mudança de backend.

## Fase 2 (próxima leva, NÃO nesta) — o valor de produto real

Onde o ICP e o Produto disseram que está o valor (o `OrcamentoCard` hoje só tem
Aprovar/Rejeitar):

- **Editar as fases inline antes de aprovar** (horas, custo/h, margem). Rejeitar
  tudo por uma linha errada é o que faz o ICP abandonar.
- **Mostrar a origem do número** (de onde a IA tirou as horas: chute? projeto
  parecido?). Sem isso o sócio refaz na planilha.
- **Desfazer** depois de aprovar (o chat já tem; a revisão não).

## Critérios de aceite (Fase 1)

- [ ] Drafts do chat abandonados não aparecem mais na fila de revisão.
- [ ] Aba "Revisão" aparece na tela Agentes só para owner, com contagem correta.
- [ ] Aprovar/Rejeitar continuam funcionando (mesmos hooks/RPC).
- [ ] Sidebar sem item "Revisão IA"; `/revisao-ia` redireciona.
- [ ] Herói do estado vazio intacto quando não há nada a revisar.
- [ ] `npm run build:strict` e `npm run test:run` passam.
