# ADR 0056: Uma Edge Function por endpoint, uniformes por regra compartilhada e teste

**Data:** 2026-10-13  
**Status:** Accepted

## Contexto

A revisão externa de 13/10 deu 6,8 para a "arquitetura das Edge Functions": 44 funções
com prefixos (`asaas-*`, `portal-*`, `send-*`, `invite-*`), lidas como fragmentadas, com
a sugestão de consolidar. O que de fato pesava era outra coisa: cada função lia o corpo
do jeito dela, 28 não tinham teste, chamadas a terceiros não tinham tempo limite e o
CORS ainda tinha um caminho legado.

- **Consolidar em poucas funções com roteamento interno**: menos pastas, mas mistura
  `verify_jwt` (público, JWT, cron e webhook no mesmo deploy), um erro derruba vários
  endpoints, o cold start e o limite de memória passam a ser compartilhados, e o catálogo
  e os alertas por função perdem precisão.
- **Uma função por endpoint, com o padrão garantido por código**: é o modelo do Supabase
  (deploy, logs, limites e `verify_jwt` por função); a consistência vem do `_shared` e de
  testes que reprovam quem foge dela.

## Decisão

Manter uma Edge Function por endpoint. A uniformidade é regra compartilhada e verificada:

- **Entrada:** corpo lido por `entrada.ts`/`esquema.ts` da própria função, sobre
  `_shared/schemas.ts` (`validar`, `lerJson`), com teste Deno.
- **Observabilidade:** todo handler em `withSentry` (ou `withSentryCron`).
- **Terceiros:** toda chamada externa por `fetchComTempo` (`_shared/http.ts`).
- **CORS:** só `getCorsHeaders(req)`/`jsonResponse`; não existe mais o objeto estático.
- **Cron:** `cronAutorizado` (`_shared/cron-auth.ts`), comparação em tempo constante.
- **Teste:** toda função tem `*.test.ts` (`TEST_DEBT.txt` vazio, teto 0).

As regras verificáveis viram teste em `scripts/edge-functions-padrao.test.ts` e
`scripts/edge-function-test-debt.test.ts`, que rodam no CI. O agrupamento por domínio
continua no catálogo (`CATALOGO.json` → `docs/architecture/EDGE_FUNCTIONS.md`), não em
pastas nem em deploys.

## Consequências

**Positivas:**

- Falha, deploy e limite de recurso isolados por endpoint; `verify_jwt` declarado por função.
- Função nova que não segue o padrão reprova no CI, em vez de depender de revisão.

**Negativas / custos:**

- Continuam sendo 40+ pastas; o mapa é o catálogo gerado, que precisa ficar em sync
  (já verificado por teste).
- Regra nova de padrão exige atualizar o teste-régua junto.
