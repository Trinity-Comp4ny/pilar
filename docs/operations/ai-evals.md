# Evals da IA (ai-chat)

Decisão: [ADR 0048](../architecture/adr/0048-mudanca-de-prompt-ou-modelo-passa-por-eval.md).

## Rodar

```bash
GEMINI_API_KEY=... deno run --allow-env --allow-net --allow-write \
  supabase/functions/ai-chat/evals/rodar.ts [--filtro injecao] [--saida resultado.json]
```

Com outro modelo (SPEC 106), sem mudar código:

```bash
AI_MODELO=gateway:anthropic/claude-haiku-5.5 AI_GATEWAY_API_KEY=... deno run --allow-env --allow-net \
  --allow-write supabase/functions/ai-chat/evals/rodar.ts
```

Com `AI_GATEWAY_API_KEY` presente, o relatório também estima o custo (preços do catálogo
do gateway) por rodada e por mil mensagens.

No GitHub: Actions → **Evals da IA** → Run workflow. Também roda sozinho em PR que mexe em
prompt, schema, extração ou no cliente do modelo, e toda segunda.

## O que mede

| Medida   | Como                                                           | Limite      |
| -------- | -------------------------------------------------------------- | ----------- |
| Intenção | modo, entidade e operação certos (agente só conta em consulta) | 90%         |
| Campos   | valor, status, parcelas, nomes extraídos nas ações             | 85%         |
| Latência | p95 de ponta a ponta (orquestrador + extração)                 | só registra |
| Tokens   | soma da rodada                                                 | só registra |

## Resultado de referência (2026-10-09, gemini-2.5-flash)

47 casos, duas rodadas seguidas: intenção 100%, campos 100%, p95 entre 3,9 e 4,9 s,
~71 mil tokens por rodada.

## Adicionar caso

Em `supabase/functions/ai-chat/evals/casos.ts`. Entra o que já quebrou, o que é ambíguo de
propósito (obra × projeto, efetivo × equipe) e o que mexe em dinheiro. Rode o caso novo
três vezes (`--filtro <id>`): se oscilar, a frase é ambígua de verdade e vira decisão de
produto, não caso.

## Decisões de produto em aberto

- "Recebi a 1ª parcela do projeto X" oscila entre lançar receita nova e dar baixa na
  parcela existente. Os dois caminhos passam pelo card de confirmação. Se a regra for "dar
  baixa quando houver parcela pendente do cliente", ela entra no prompt do orquestrador e o
  caso volta para a suíte.
