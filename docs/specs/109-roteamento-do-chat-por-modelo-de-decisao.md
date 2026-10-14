# SPEC: Roteamento do chat por modelo de decisão (Jev), com o modelo de texto de reserva

**Data:** 2026-10-13  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** IA (ai-chat)  
**Depende de:** [SPEC 108](./108-modelo-de-ia-por-configuracao.md), [ADR 0051](../architecture/adr/0051-modelo-de-ia-por-configuracao-com-gateway.md), [ADR 0052](../architecture/adr/0052-roteamento-do-chat-por-modelo-de-decisao.md)

## Problema

Antes de a resposta do chat começar a aparecer, o orquestrador classifica a mensagem (área,
consulta, cadastro ou operação, e o quê) com um modelo de texto. É a maior espera fixa de toda
mensagem: p50 de 1,4 s e p95 de 2,9 s com o Claude Haiku 5.5 nos evals.

## Objetivo

Classificar com um modelo de decisão do Vercel AI Gateway (`typesafe-ai/jev`), que escolhe
entre opções fechadas em ~0,35 s, sem perder acerto: quando ele falhar, demorar ou ficar em
dúvida, o modelo de texto classifica como hoje.

**Fora de escopo:** extração de campos e resposta (continuam no modelo de texto), fallback
configurado no próprio gateway, roteamento das outras funções de IA.

## Requisitos

1. `AI_DECISAO_AI_CHAT=gateway:<fornecedor>/<modelo>` liga o modelo de decisão. Sem a
   variável, nada muda.
2. Quatro perguntas de escolha num pedido só (`POST /v1/evaluate`): agente, modo, entidade e
   operação, com as mesmas opções do `IntentSchema` (mais "nenhuma" em entidade e operação).
   O estado vai estruturado e sanitizado: data, conversa anterior, mensagem atual e projeto em
   foco.
3. A decisão só vale se as respostas que importam para o modo escolhido passarem de 0,7 de
   probabilidade (agente na consulta, entidade na ação, operação na operação) e o resultado
   passar no `IntentSchema`.
4. Falha, timeout de 2 s, dúvida ou resposta fora do schema: classifica com o modelo de texto
   (`ORQUESTRADOR_PROMPT`). Erro vai ao Sentry; toda decisão conta na métrica
   `ai.roteamento` (via `decisao` ou `modelo`, com o motivo).
5. Um débito por turno, como antes: os tokens do roteamento (do modelo de decisão e, se
   houver, do de texto) entram no débito do turno.
6. Os evals do ai-chat usam o mesmo `classificarIntencao` da produção e mostram quantos casos
   o modelo de decisão resolveu sozinho.

## Critérios de aceite

- [x] Deno: opções das perguntas iguais às do `IntentSchema`, leitura da decisão (limiar,
      ação sem entidade, operação sem alvo, opção fora do schema), leitura da resposta do
      `/v1/evaluate`, configuração.
- [x] Evals com Haiku + Jev: 100% de intenção e de campos em 2 rodadas completas; roteamento
      com p50 de 0,35 s e p95 de 0,55 a 0,8 s (Haiku sozinho: 1,4 s e 2,9 s).
- [x] Calibração do limiar: Jev sozinho acertou 141 de 141 em 3 rodadas; a menor confiança
      num acerto foi 0,61, e abaixo de 0,7 só ficaram cadastros de receita e despesa (~8% dos
      casos), que vão para o modelo de texto.
- [ ] Ligado em staging e conferido à mão, com a métrica `ai.roteamento` no Sentry.
