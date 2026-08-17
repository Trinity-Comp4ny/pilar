# Primeiros dias pós-lançamento — checklist de acompanhamento

Item "Acompanhar erros, p95, conexões e filas nos primeiros dias" do plano de
30 dias. Ferramental já existe (Sentry, `/health`, `pg_stat_statements`) — este
doc só junta onde olhar e o que é normal vs. alarme, pra não precisar decidir
isso no calor do lançamento.

## O que olhar todo dia (primeira semana), 2x/dia

### 1. Erros (Sentry)

- Dashboard → Issues, filtro por `environment:production`, ordenado por
  `events` (não por `last seen` — um erro raro e um erro em loop parecem
  iguais ordenados por tempo).
- **Alarme:** qualquer issue nova com > 10 eventos/hora, ou qualquer issue
  em `supabase/functions/*` marcada `level:error` que não existia antes do
  deploy do dia.
- `release` de cada evento agora vem preenchido de verdade (fix 17/08, PR
  #255) — dá pra isolar "isso começou no deploy X" sem adivinhar.

### 2. Latência (p95) e conexões (Postgres)

Rodar contra o projeto de produção (via `mcp__claude_ai_Supabase__execute_sql`
ou psql direto):

```sql
-- Top queries por tempo total (acumulado desde o último reset do stats)
select regexp_replace(query, '\s+', ' ', 'g') as query, calls,
       round(mean_exec_time::numeric, 2) as mean_ms,
       round(max_exec_time::numeric, 2) as max_ms
from pg_stat_statements
order by total_exec_time desc limit 15;

-- Conexões e locks
select
  (select count(*) from pg_stat_activity) as total_connections,
  (select count(*) from pg_stat_activity where state = 'idle in transaction') as idle_in_tx,
  (select setting::int from pg_settings where name = 'max_connections') as max_connections,
  (select count(*) from pg_locks where not granted) as ungranted_locks;
```

**Baseline conhecido (medido 17/08, staging, 30 VUs simulados):** RPCs em
0.4-5ms no servidor, p95 de rede ~320ms, 24/60 conexões, 0 idle-in-transaction,
0 lock não concedido. **Alarme:** `idle_in_tx` > 5 sustentado (conexão vazando
sem `COMMIT`/`ROLLBACK`), `ungranted_locks` > 0 sustentado, ou `mean_ms` de
alguma query subindo 5x+ o baseline.

### 3. Filas / jobs assíncronos

- `agent_runs` (spec 045): `select status, count(*) from agent_runs group by status;`
  — `status = 'failed'` acumulando é sinal de algo quebrado sem alerta.
- Cron jobs (`itau-sync`, `bradesco-sync`, `backup-nightly`): aba Actions →
  filtrar por workflow → confirmar que o último run foi verde. Falha já abre
  issue automaticamente (`notify-cron-failure`), mas checar mesmo assim nos
  primeiros dias.

### 4. Synthetic / uptime

- Depende de você ativar Checkly/BetterStack (ver `checkly-setup.md`,
  `status-page-setup.md`) — enquanto não tiver conta criada, `/health` só é
  monitorado manualmente: `curl $PILAR_HEALTH_URL | jq`.

## Depois da primeira semana

Reduzir a cadência conforme a confiança sobe (ex.: 1x/dia → 2x/semana). Se
Checkly/BetterStack estiverem ativos, os alertas substituem boa parte da
checagem manual — este checklist vira backup, não rotina.
