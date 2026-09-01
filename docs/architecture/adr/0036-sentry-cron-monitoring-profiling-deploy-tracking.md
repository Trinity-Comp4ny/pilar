# ADR 0036: Cron Monitoring, Environment Split, Browser Profiling e Deploy Tracking no Sentry

**Data:** 2026-09-01
**Status:** Accepted

## Contexto

Auditoria do setup Sentry (ADR 0004, ADR 0027) achou quatro lacunas, todas de baixo custo de implementação:

- **Crons (Insights > Crons)**: os 5 `pg_cron` jobs do banco (`gerar-notificacoes-ambient`, `trial-expiry-daily`, `audit-log-cleanup`, `rate-limit-cleanup`, `cleanup-pending-signups`) rodam via SQL puro ou `net.http_post` direto pra uma edge function, sem nunca avisar o Sentry que rodaram. Um job que para de disparar (cron desagendado por engano, função quebrada silenciosamente) não aparece em lugar nenhum: foi exatamente o que aconteceu com `gerar_notificacoes_ambient` antes ([memória do projeto](../../..)), e é o motivador direto desta decisão.
- **Environment**: nem frontend nem backend distinguiam staging de produção. O frontend caía em `import.meta.env.MODE` (sempre `"production"` em qualquer `vite build`, independente do ambiente da Vercel); o backend nunca tinha `SENTRY_ENV` setado nos secrets do Supabase (default `"production"` em `_shared/sentry.ts`). Staging e produção viravam o mesmo bucket de erros no Sentry.
- **Profiling (browser)**: flame graph de JS lento no client. `@sentry/react` (`^10.70.0`, já instalado) inclui `browserProfilingIntegration` nativamente, sem pacote novo.
- **Release deploy tracking**: o frontend é buildado e deployado pela Vercel diretamente (o `ci.yml` só cobre o backend Supabase), então o release já sai com nome (`vite.config.ts`, `SENTRY_RELEASE`), mas nunca um "deploy" associado: a timeline do release no Sentry não mostra quando cada versão foi ao ar.

## Decisão

**Environment**: `vite.config.ts` calcula `SENTRY_ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.SENTRY_ENV ?? "development"` e injeta via `define` como `__SENTRY_ENVIRONMENT__`, consumido em `src/lib/monitoring.ts` (com `VITE_SENTRY_ENV` como override explícito, se setado). `VERCEL_ENV` já vem de graça em todo build da Vercel (`"production"` ou `"preview"`), sem exigir configurar nada manualmente por ambiente no dashboard. No backend, `ci.yml` passa a setar `SENTRY_ENV=staging`/`SENTRY_ENV=production` junto do `SENTRY_RELEASE` já existente, um por job de deploy.

**Crons**: função `public.sentry_cron_checkin(slug, status, check_in_id)`, criada via migration, que:
- Lê `current_setting('app.sentry_dsn', true)` (mesmo padrão manual-por-ambiente de `app.supabase_url`/`app.service_role_key`, ver `20260514300002_setup_trial_expiry_cron.sql`). Sem o setting, é no-op silencioso: dev local nunca quebra.
- Faz parse do DSN via regex e monta a URL de check-in HTTP nativa do Sentry Crons (`https://<host>/api/<project>/cron/<slug>/<public_key>/?status=<status>&check_in_id=<uuid>`), documentada em `docs.sentry.io/product/crons/getting-started/http/`. Sem SDK, só `net.http_post` (pg_net já é dependência existente, mesmo pacote usado pelo trigger de deleção de dados e pelo cron de trial).
- Cada job vira um wrapper (`<job>_monitored()`) que faz check-in `in_progress`, roda o trabalho real dentro de um `BEGIN/EXCEPTION`, e faz check-in `ok` ou `error`. `cron.schedule` passa a chamar o wrapper, não a função original.

Trade-off aceito: o DSN vira um setting de banco (`ALTER DATABASE postgres SET app.sentry_dsn = '...'`, manual por ambiente). Não é segredo crítico, é a mesma DSN pública já embutida no bundle do browser (`VITE_SENTRY_DSN`), mas passa a viver também na config do Postgres, não só em variável de ambiente de aplicação.

**Profiling**: `Sentry.browserProfilingIntegration()` adicionado às integrations do `Sentry.init` em `src/lib/monitoring.ts`, com `profilesSampleRate` amarrado à mesma env var de tracing (não introduz sample rate novo pra configurar).

**Deploy tracking**: `sentryVitePlugin` em `vite.config.ts` ganha `release.deploy = { env: SENTRY_ENVIRONMENT }` (o mesmo valor calculado pro environment split acima). Roda automaticamente em todo build de produção na Vercel, sem tocar `ci.yml` (que não builda o frontend).

## Consequências

**Positivas:**

- Dropdown de Environment no Sentry (Issues, Insights, Releases) separa staging de produção de verdade, sem configuração manual que alguém possa esquecer de repetir num ambiente novo.
- Job de cron que para de rodar aparece como "missed" em Insights > Crons, sem esperar o efeito colateral de negócio aparecer dias depois.
- Profiling mostra hot path real de JS no client, complementa o profiling de custo de banco que já existe via `slow-query`-style logs.
- Timeline de release mostra quando cada deploy foi ao ar, sem esforço manual.

**Negativas:**

- Mais uma chamada de rede (fire-and-forget via `pg_net`) por execução de cron: falha de rede na checagem não derruba o job (envolto em bloco separado, nunca re-lança), mas adiciona uma dependência externa a mais no caminho crítico do agendador.
- `app.sentry_dsn` precisa ser setado manualmente em staging e produção (mesma dívida operacional já existente pros outros `app.*` settings, ver `project_pg_cron_alertas_ambient` na memória do projeto). Sem o setting, cron monitoring fica silenciosamente inativo, mitigado pelo no-op ser seguro, não pelo esquecimento ser impossível.
- `VERCEL_ENV="preview"` cobre staging e qualquer PR preview no mesmo bucket. Suficiente pra separar de produção, mas não distingue staging de um preview avulso caso isso vire relevante no futuro.

## Decisões relacionadas

- [ADR 0004](./0004-edge-function-observability.md): base do envelope HTTP manual.
- [ADR 0027](./0027-sentry-metrics-e-agent-replay-completo.md): Application Metrics e Agent replay, mesma linhagem de decisões Sentry.
- [ADR 0030](./0030-erro-de-fronteira-sempre-reportado.md): mesma auditoria encontrou catches manuais (Asaas, geração de PDF) que engolem erro sem reportar; corrigidos junto nesta leva, fora do escopo de decisão arquitetural deste ADR.
