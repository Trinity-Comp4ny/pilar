# Staging isolado + CD do backend

Objetivo: parar de deployar migrations e edge functions à mão, e isolar staging
de produção. Hoje o front de staging aponta para o Supabase de **produção** — este
setup corrige isso com um **segundo projeto Supabase** (cabe no free tier: 2 projetos).

Depois de configurado, o fluxo passa a ser 100% git-driven:

```
push staging → CI verde → deploy no Supabase de STAGING → E2E contra staging
merge  main  → CI verde → deploy no Supabase de PRODUÇÃO (com aprovação, opcional)
```

Nenhum `supabase db push` ou `functions deploy` manual.

---

## Passo 1 — Criar o projeto de staging (~10 min, feito 1 vez)

1. Supabase → **New project** → `pilar-staging` (mesma região do prod).
2. Guarde o **Project ref** (ex.: `abcd...`) e a **Database password**.
3. Replicar o schema no projeto novo (uma vez):
   ```bash
   brew upgrade supabase   # use CLI ≥ 2.109 — versões antigas quebram no split de migrations
   supabase link --project-ref <REF_STAGING>
   # SEMPRE passe --db-url / --project-ref explícitos: sem eles, o CLI usa o
   # project_id do config.toml (= PRODUÇÃO) e você deploya no lugar errado.
   supabase db push --db-url "postgresql://postgres.<REF_STAGING>:<SENHA>@aws-1-<REGIAO>.pooler.supabase.com:5432/postgres"
   supabase functions deploy --project-ref <REF_STAGING>
   ```

   > ⚠️ **Nunca** rode `db push`/`functions deploy` sem alvo explícito durante o bootstrap:
   > o `config.toml` aponta pro prod, então o comando "pelado" vai pra produção.
   > Use `--db-url` (pooler IPv4, contorna o IPv6) no push e `--project-ref` no deploy.

   > **Dois tropeços conhecidos em projeto novo (PG17), já mapeados:**
   >
   > a) `ERROR: function gen_random_bytes(integer) does not exist` — o pgcrypto fica no
   >    schema `extensions`, fora do search_path do role de migration. Rode uma vez no
   >    **SQL Editor** de staging e re-rode o push (é resumível):
   >    ```sql
   >    ALTER DATABASE postgres SET search_path TO "$user", public, extensions;
   >    ```
   >
   > b) `ERROR: cannot insert multiple commands into a prepared statement (42601)` — bug de
   >    CLI antigo em migrations com `CREATE FUNCTION` + `GRANT` juntos. Resolve com
   >    `brew upgrade supabase` (CLI ≥ 2.109). Plano B: rodar a migration no SQL Editor +
   >    `supabase migration repair --status applied <version>`.
4. Configurar os **secrets das funções** em staging (o CD **não** gerencia isso, de
   propósito, pra não vazar segredo em log). No dashboard do projeto staging, em
   *Edge Functions → Secrets*, replicar as chaves de prod com valores de **sandbox**:
   `RESEND_API_KEY`, `AUTH_HOOK_SEND_EMAIL_SECRET`, `ASAAS_API_KEY` (sandbox),
   `TURNSTILE_SECRET`, `SENTRY_DSN`, etc.
5. Auth → URL Configuration: apontar `Site URL` e redirect URLs pro domínio de staging.
6. Criar o usuário de teste E2E (`E2E_TEST_EMAIL`) neste projeto.

## Passo 2 — Apontar o front de staging pro Supabase de staging

Na Vercel, no ambiente **Preview/staging** do projeto, setar:

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto **staging** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key do **staging** |

Produção continua com as chaves de prod. Isso encerra o risco de staging→prod.

## Passo 3 — Secrets do GitHub (por Environment)

Em *Settings → Environments*, criar **`staging`** e **`production`**. Em produção,
marcar **Required reviewers** (você) — assim todo deploy de prod pede 1 clique de aprovação.

**Environment `staging`:**

| Secret | Valor |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | token de acesso da conta (Account → Access Tokens) |
| `SUPABASE_PROJECT_REF` | ref do projeto **staging** |
| `SUPABASE_DB_URL` | URI do Session Pooler (IPv4) de staging c/ senha embutida — runner do GitHub é IPv4-only |
| `STAGING_SUPABASE_URL` | URL do projeto staging (pro E2E) |
| `STAGING_SUPABASE_ANON_KEY` | anon key staging (pro E2E) |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` | usuário de teste |
| `E2E_PORTAL_EMAIL` / `E2E_PORTAL_PASSWORD` | opcional (portal) |

**Environment `production`:**

| Secret | Valor |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | mesmo token (ou um específico de prod) |
| `SUPABASE_PROJECT_REF` | `vepnsonbnsimqcsfcagm` (prod atual) |
| `SUPABASE_DB_URL` | URI do Session Pooler (IPv4) de **produção** c/ senha embutida |

## Passo 4 — Pronto

- `.github/workflows/deploy-supabase.yml` já faz o deploy por branch.
- `.github/workflows/e2e-staging.yml` roda Playwright contra staging após cada deploy.
- `verify_jwt` por função vive em `supabase/config.toml` — deploy respeita, sem flags manuais.

### Verificação

- Push numa branch → PR pra `staging` → merge → ver o run "Deploy Supabase" (staging).
- Confirmar no dashboard de staging que migrations e funções subiram.
- Um webhook (ex.: `asaas-webhook`) deve responder **sem** exigir JWT — se der 401,
  revisar o bloco `[functions.*]` em `config.toml`.
