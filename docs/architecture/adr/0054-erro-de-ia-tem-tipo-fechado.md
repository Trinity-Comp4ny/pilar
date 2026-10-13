# ADR 0054: Erro de IA tem tipo fechado, com mensagem e status próprios

**Data:** 2026-10-13  
**Status:** Accepted

## Contexto

Cada edge function `ai-*` tratava falha do modelo do seu jeito. O `ai-chat` respondia
"Erro ao processar a conversa" para tudo, de 429 do Google a bug nosso. `ai-import-financeiro`,
`ai-cotacao-import` e `ai-rdo-voz` devolviam `err.message` ao usuário, que podia ser
`Gemini API error (500): {...}` com o JSON interno do provedor. Nenhuma distinguia falha
passageira (vale tentar de novo) de falha que se repetiria igual, e um 429 derrubava o
pedido na primeira tentativa.

Opções consideradas:

- **Mensagem por handler**: cada função escreve a sua. Já era assim e divergiu.
- **Repassar o status do provedor**: 429 do Google viraria 429 do Pilar, que o front já lê
  como "muitas chamadas de IA em sequência" (o nosso anti-rajada). Mistura as duas coisas.
- **Tipo fechado no `_shared`** (escolhida).

## Decisão

`supabase/functions/_shared/ai-erros.ts` define `TipoErroIa` (`limite_do_provedor`,
`provedor_indisponivel`, `tempo_esgotado`, `saida_truncada`, `saida_invalida`, `bloqueada`,
`configuracao`, `desconhecido`) e a tabela `RESPOSTA_ERRO_IA` com status e mensagem de cada.

- O cliente de IA lança `ErroIa` com o tipo. Erro comum (adaptador do gateway) é
  classificado pelo texto.
- Só `limite_do_provedor` e `provedor_indisponivel` ganham nova tentativa
  (`comNovaTentativa`), com espera crescente e dentro do prazo da chamada.
- Handler responde com `respostaDeErroIa(e, headers, fn)`: `{ error, tipo }`, status do
  tipo, texto bruto só no log. `configuracao` e `desconhecido` vão pro Sentry; os demais já
  ficam no span `gen_ai` com `error.type`.
- 429 do provedor sai como 503: o 429 do Pilar continua significando o anti-rajada.

Tipo novo entra na lista e na tabela, com teste. Handler não escreve mensagem de erro de IA
à mão.

## Consequências

**Positivas:**

- O usuário lê o que houve e o que fazer, sem JSON interno nem id de projeto do provedor.
- 429 e 503 passageiros se resolvem sem o usuário perceber.
- Sentry recebe só o que pede ação nossa; o resto vira métrica e span.

**Negativas:**

- Erro do gateway é classificado pelo texto da mensagem: se o formato em `llm.ts` mudar, o
  tipo vira `desconhecido` (ainda seguro: mensagem genérica e Sentry).
- Nova tentativa aumenta a latência no pior caso em até ~2,3 s de espera.

## Decisões relacionadas

- [SPEC 110](../../specs/110-cliente-de-ia-previsivel.md): implementação, junto com
  temperatura, teto de raciocínio e proveniência no `agent_runs`.
- [ADR 0048](./0048-mudanca-de-prompt-ou-modelo-passa-por-eval.md): evals da mudança.
