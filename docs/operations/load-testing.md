# Estrategia de Load Testing — Pilar

Documento define quando rodar a suite k6, como interpretar resultados e onde registrar baselines.

## Quando rodar

| Gatilho                                   | Cenarios                                                | Obrigatorio? |
| ----------------------------------------- | ------------------------------------------------------- | ------------ |
| Antes de release a producao               | Todos                                                   | Sim          |
| Apos mudanca de schema (nova migration)   | `dashboard-read`, `listar-lancamentos`, `criar-receita` | Sim          |
| Apos mudanca em RLS policy                | `dashboard-read`, `listar-lancamentos`                  | Sim          |
| Apos mudanca em edge function `webhook-*` | `webhook-asaas`                                         | Sim          |
| Apos mudanca em Auth flow                 | `login`                                                 | Sim          |
| Semanal, automático (staging)             | `dashboard-read`, `listar-lancamentos` (perfil leve)    | Sim          |

## Rodada semanal automática

`.github/workflows/carga-semanal.yml` roda toda segunda às 6h (UTC) contra o staging, com
`K6_PERFIL=semanal` (até 10 VUs por 5 minutos), os dois cenários de leitura. Falha quando
passa dos limites de `tests/load/utils/setup.js` (p95 < 500 ms, falha < 1%). O mesmo
limite de p95 é aplicado separadamente à RPC `get_painel_gestao`. O resumo
(p95 e taxa de falha) fica no job e o JSON como artifact por 90 dias: é a série histórica
que preenche a tabela de baseline abaixo. Recusa a URL de produção.

## Como rodar (resumo)

Pre-requisitos: `tests/load/README.md` cobre instalacao + env vars.

```bash
# Smoke (5 VUs, 1min) — sanidade antes de carga real
k6 run --vus 5 --duration 1m tests/load/scenarios/login.js

# Full run
for f in tests/load/scenarios/*.js; do
  k6 run --out json=results/$(basename $f .js)-$(date +%s).json "$f" || break
done
```

## Como interpretar resultados

k6 imprime um sumario ao final. Olhar nesta ordem:

1. **`checks`** — % de assertions que passaram. Alvo: 100%. <99% indica regressao funcional sob carga.
2. **`http_req_failed`** — taxa de erro HTTP. Alvo: <1%. Picos significam timeouts, 5xx ou rate limit.
3. **`http_req_duration p(95)`** — latencia no 95-percentil. Alvo padrao: <500ms.
4. **`errors` (custom counter)** — falhas em validacoes de negocio (ex: response sem `id`).
5. **`iterations`** — total de iteracoes. Comparar entre runs para detectar throughput regressions.

### Sinais de problema

- `http_req_duration p(99)` muito alto vs `p(95)` -> tail latency, candidato a investigar locks/timeouts.
- `http_req_blocked` alto -> connection pool saturado.
- `http_req_waiting` alto -> backend lento (DB, edge function).
- `http_req_failed` sobe quando VUs aumentam -> rate limit ou exhaustion de recursos.

### Comandos uteis

```bash
# Filtrar so as requests de um endpoint especifico
k6 run --tag name=criar_receita tests/load/scenarios/criar-receita.js

# Exportar para Grafana/Influx
k6 run --out influxdb=http://localhost:8086/k6 ...
```

## Baseline de leitura em staging

A [execução manual de 20/11/2026](https://github.com/Trinity-Comp4ny/pilar/actions/runs/44763287492)
usou o commit `cd1ba36b`, com até 10 VUs por cenário.

| Cenário                              | p95 (ms) | p99 (ms) | Falhas    | Iterações |
| ------------------------------------ | -------: | -------: | --------- | --------: |
| `dashboard-read`                     |   161,82 |    1.250 | 0 / 3.998 |     1.332 |
| RPC `get_painel_gestao` no dashboard |   302,98 |    2.200 | —         |         — |
| `listar-lancamentos`                 |    90,81 |   143,01 | 0 / 3.126 |     3.123 |

Os cenários de login, criação de receita e webhook aguardam uma baseline no ambiente dedicado.

> **Regra:** se nova run regredir >20% em qualquer metrica vs baseline, bloquear release ate investigar.

## Riscos e mitigacoes

- **Rodar em prod**: nunca. README.md tem aviso explicito. CI deve ter guard que recusa `K6_SUPABASE_URL` apontando para projeto de prod.
- **Dados orfaos**: `criar-receita.js` tem `teardown()` que deleta rows com prefixo `LoadTest`. Verificar manualmente em sandbox apos cada run.
- **Custo Supabase**: 100 VUs \* 5min pode gerar milhares de requests. Em sandbox paga, monitorar billing.
- **Idempotencia webhook**: `webhook-asaas.js` envia 30% dos events com IDs duplicados. Edge function precisa dedupe via unique constraint na tabela de webhook events.

## Roadmap

- [ ] Adicionar cenario para Edge Functions de IA quando reativadas (modulo dormente hoje).
- [ ] Adicionar scenario para portal cliente (auth flow diferente).
- [ ] Integrar com CI: rodar smoke (5 VUs, 1min) em PRs que mexem em `supabase/`.
- [ ] Dashboard Grafana com historico de baselines.


O resumo semanal separa o p95 da RPC `get_painel_gestao` do p95 geral
do cenário e grava p99, percentual de falhas, throughput e SHA. Preserve o
artefato bruto para comparar novas rodadas com a referência. O cenário composto inclui autenticação e outras leituras, por
isso o p95 geral não representa a latência isolada do painel.


Antes de iniciar a rampa, os cenários semanais confirmam os contratos da
RPC do painel e da paginação de receitas e despesas. O PostgREST pode
retornar HTTP 206 em uma página válida. O cenário usa o total informado para
sortear até dez páginas existentes por tipo. Erros de preflight invalidam a
medição e mostram a operação e o status, sem expor o conteúdo da resposta.
