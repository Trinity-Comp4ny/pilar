# Evals da IA (ai-chat)

Decisão: [ADR 0048](../architecture/adr/0048-mudanca-de-prompt-ou-modelo-passa-por-eval.md).

## Rodar

```bash
GEMINI_API_KEY=... deno run --allow-env --allow-net --allow-write \
  supabase/functions/ai-chat/evals/rodar.ts [--filtro injecao] [--saida resultado.json]
```

Com outro modelo (SPEC 108), sem mudar código:

```bash
AI_MODELO=gateway:anthropic/claude-haiku-5.5 AI_GATEWAY_API_KEY=... deno run --allow-env --allow-net \
  --allow-write supabase/functions/ai-chat/evals/rodar.ts
```

Com `AI_GATEWAY_API_KEY` presente, o relatório também estima o custo (preços do catálogo
do gateway) por rodada e por mil mensagens.

Com o modelo de decisão no roteamento (SPEC 109), o mesmo caminho da produção:

```bash
AI_MODELO_AI_CHAT=gateway:anthropic/claude-haiku-5.5 AI_DECISAO_AI_CHAT=gateway:typesafe-ai/jev \
  AI_GATEWAY_API_KEY=... deno run --allow-env --allow-net --allow-write \
  supabase/functions/ai-chat/evals/rodar.ts
```

O relatório diz quantos casos o modelo de decisão resolveu sozinho. O custo estimado usa o
preço do modelo de texto para todos os tokens, então fica acima do real quando há modelo de
decisão (o Jev cobra US$ 0,042 por milhão de entrada e nada de saída).

No CI, o workflow mede a configuração das variáveis de repositório `AI_MODELO_AI_CHAT` e
`AI_DECISAO_AI_CHAT` (mantenha iguais às das Edge Functions de produção).

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

## Comparação de modelos (2026-10-09 a 2026-10-13)

47 casos, 2 a 5 rodadas por modelo, custo por mil mensagens pelo catálogo do gateway:

| Modelo                        | Intenção     | Campos      | p95 total   | US$/mil msgs |
| ----------------------------- | ------------ | ----------- | ----------- | ------------ |
| gemini-2.5-flash (padrão)     | 100%         | 100%        | 4,6 a 5,9 s | 1,07         |
| gemini-3.8-flash              | 100%         | 100%        | 6,9 a 8,1 s | 2,14         |
| claude-haiku-5.5              | 100%         | 100%        | 3,9 a 6,3 s | 0,32         |
| claude-sonnet-5.5             | 100%         | 100%        | 4,9 a 6,1 s | 5,85         |
| gpt-5.4-mini                  | 95,7 a 97,9% | 92,9 a 100% | 2,2 a 2,4 s | 1,32         |
| gpt-5.6-luna                  | 99,6%        | 100%        | 5,4 a 7,3 s | 0,40         |
| claude-haiku-5.5 + jev (rota) | 100%         | 100%        | 3,0 a 3,2 s | ~0,13        |

Só o roteamento (consultas, operações e injeção): Haiku p50 1,4 s e p95 2,9 s; Haiku + Jev
p50 0,35 s e p95 0,55 a 0,8 s, com o Jev decidindo 44 a 46 dos 47 casos. O custo da linha
Haiku + Jev separa os tokens de cada modelo (o relatório do script mostra ~0,39 porque cobra
tudo pelo preço do Haiku).

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
