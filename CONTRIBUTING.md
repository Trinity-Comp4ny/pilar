# Contributing

## Setup

```bash
git clone <repo>
cd pilar
npm install
cp .env.example .env  # preencha as VITE_* abaixo
```

Mínimo no `.env`:

- `VITE_SUPABASE_URL` — projeto Supabase (local ou cloud)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon key
- `VITE_SENTRY_DSN` — opcional em dev

## Banco local (Supabase)

```bash
npx supabase start         # sobe Postgres + APIs em containers
npx supabase status        # mostra DB URL e portas
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/migrations/<algum>.sql

# Aplicar TODAS as migrations:
for f in supabase/migrations/*.sql; do
  psql "$DB_URL" -f "$f"
done

# Regenerar types:
npm run gen:types
```

## Scripts

| Comando                     | Para quê                                       |
| --------------------------- | ---------------------------------------------- |
| `npm run dev`               | Vite dev server                                |
| `npm run typecheck`         | `tsc --noEmit`                                 |
| `npm run test:run`          | Vitest unit tests                              |
| `npm run test:e2e`          | Playwright (precisa `npm run preview` rodando) |
| `npm run build`             | Produção                                       |
| `npm run build:strict`      | typecheck + build                              |
| `npm run check:bundle-size` | Falha se chunk passa do budget                 |
| `npm run lint` / `lint:fix` | ESLint                                         |
| `npm run format`            | Prettier                                       |

## Convenções

- **PT-BR** em UI/comentários; **EN** em commits/branches/PRs.
- Sem `console.log` em código final. Use `monitoring.captureException`/`captureMessage` (frontend) ou `createLogger` (Edge Functions).
- Early returns; sem `else if` desnecessários.
- Component naming: PascalCase. Hooks: `use*`. Types: PascalCase.
- Strings de erro pra usuário sempre via `useToast` ou `toast.error()` — nunca `alert()`.

## Permissões e segurança

### Modelo

- **`role`** governa **administrativo**: convidar usuários, billing, gerir empresa, audit logs.
- **`features`** governam **operacional**: o que cada user vê/edita em módulos.
- **Ultra_admin** (você, plataforma) bypassa tudo.
- **Admin da empresa-cliente** precisa ter features marcadas — não bypassa.

### Camadas

1. **Empresa** (`empresas.features`): plano comprado libera features no nível empresa.
2. **User** (`profiles.features`): admin distribui features entre seu time, dentro do que o plano libera.
3. **RLS** (`user_has_feature(feat, level)` ou `current_effective_role()`): policy do banco verifica em runtime.

### RLS — qual pattern usar?

| Operação                       | Pattern                                               |
| ------------------------------ | ----------------------------------------------------- |
| Plataforma (cross-empresa)     | `current_effective_role() = 'ultra_admin'`            |
| Administrativa (gerir empresa) | `current_effective_role() IN ('admin','ultra_admin')` |
| Operacional (módulos)          | `user_has_feature('financeiro', 'editor')`            |
| Pessoal (próprio profile)      | `auth.uid()` direto                                   |

**Nunca use `has_role(...)` em policies novas.** Função legada, não respeita impersonation.

### Impersonation

- Frontend: `useImpersonation()` lê do servidor via RPC `current_impersonation()`.
- Backend: tabela `impersonation_sessions` (autoritativa, expira 30min).
- RLS respeita via `current_effective_role()` — admin impersonando user perde acesso administrativo.

## Hooks pre-commit

Configurado via Husky:

1. `gitleaks` — bloqueia commit com secrets.
2. `tsc --noEmit` — typecheck.
3. `lint-staged` — eslint + prettier nos staged.
4. `vitest run` — testes unitários.

Para pular em emergência: `git commit --no-verify` (use com discrição, CI ainda valida).

## CI

O que roda hoje (`.github/workflows/ci.yml`), em push e PR para `main` e `staging`:

- **lint-test-build** — eslint, typecheck, vitest, build e budget de bundle.
- **audit** — `npm audit --audit-level=high`.
- **secrets-scan** — gitleaks sobre o histórico inteiro.
- **deploy-staging** — só em push no `staging`, depois dos três acima. Aplica migrations
  e deploya edge functions no Supabase de staging.
- **deploy-production** — só em push no `main`, com aprovação do Environment `Production`.

- **database** — sobe o stack Supabase completo (`supabase start`), aplica as 183
  migrations num banco vazio, roda as 9 suites pgTAP de `supabase/tests/` (~80 asserts em
  RLS, impersonation e features) e confere que `types.ts` está em sync com as migrations.
  Inclui o **guard de migration destrutiva**, que roda antes de qualquer `db push`.
- **edge-functions** — `deno check` nas 44 funções de `supabase/functions/`.
- **ci-ok** — job agregado, é o único required check do branch protection.

Antes de abrir PR com migration nova, dá para rodar o guard local:

```bash
npm run check:migrations
```

Ele bloqueia `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `TRUNCATE`, `DELETE` sem `WHERE`
e `DISABLE ROW LEVEL SECURITY`. Se a perda de dado é intencional, rode com
`ALLOW_DESTRUCTIVE_MIGRATION=true` (no CI, repository variable de mesmo nome) e explique
o porquê no PR. `DROP POLICY` e `DROP FUNCTION` seguidos do `CREATE` correspondente
passam limpo: são o padrão do repo.

Depois do deploy em staging (não em PR):

- **e2e** — job `E2E → staging (Playwright)`, roda contra o staging recém-deployado.
  Os 4 specs sem login (`landing`, `login-validation`, `portal-cliente`, `security`)
  bloqueiam o job. Os 6 specs `*-authenticated.spec.ts` só rodam quando os secrets
  `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` existirem no Environment `Staging`; sem eles o
  job avisa e segue. Não entra no `ci-ok`: falha aqui é sinal para investigar staging,
  não para bloquear merge.

  O antigo `e2e-staging.yml` foi removido. Ele nunca executou uma única vez: o
  `workflow_run` apontava para "Deploy Supabase", workflow deletado em `bd77a39`, e
  gatilho desse tipo só se registra a partir da branch default.

## Edge Functions

Toda função em `supabase/functions/` deve:

```typescript
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("nome-da-funcao");

serve(
  withSentry("nome-da-funcao", async (req) => {
    // ...
    log.info("operação X", { context });
    // ...
  })
);
```

`withSentry` captura exceções não tratadas. `createLogger` emite JSON estruturado com PII scrubbing (CPF/CNPJ/CEP).

## Migrations

- Nome: `YYYYMMDDhhmmss_descricao.sql` (timestamp = quando foi criada).
- Idempotente quando possível (`CREATE OR REPLACE`, `IF NOT EXISTS`).
- Cuidado com triggers: usam `session_replication_role = 'replica'` em pgTAP.
- `npm run gen:types` após qualquer mudança de schema, e commite o `types.ts`.
  **O CI não valida isso** (o gate foi removido em `83d62e4`), então esquecer significa
  código chamando tabela ou RPC que o tipo não conhece, passando no typecheck via cast e
  quebrando em runtime. O comando gera de **staging** por default (ADR 0007); para prod,
  `npm run gen:types:prod`.

## pgTAP

Testes em `supabase/tests/*.sql`. Cada arquivo:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(N);

-- setup (pode usar SET LOCAL session_replication_role = 'replica' pra inserir auth.users)
-- testes ok / is / throws_ok / lives_ok / cmp_ok

SELECT * FROM finish();
ROLLBACK;
```

Rodar local:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/policy_feature_based.sql
```

## Estrutura

```
src/
  pages/          # Uma pasta por módulo
  components/     # UI compartilhado + hooks de UI
  hooks/          # Hooks globais (data fetching)
  contexts/       # AuthContext, ImpersonationContext
  lib/            # Helpers (sanitize, monitoring, etc)
  schemas/        # Zod schemas
  integrations/supabase/   # client.ts + types.ts gerado
supabase/
  functions/      # Edge Functions Deno
  migrations/     # SQL numerado por timestamp
  tests/          # pgTAP
e2e/              # Playwright specs
scripts/          # Build/CI utilitários
```

## Dependencies sensíveis

- `@supabase/supabase-js` — atualize com cuidado (tipos podem mudar).
- `@sentry/react` — frontend; Edge Functions usam envelope direto (`_shared/sentry.ts`).
- `dompurify` — sanitização HTML (templates de propostas).
- `dompurify` + `react-hook-form` + `zod` — sempre que adicionar form, use os 3 juntos.

## Troubleshooting

- **Typecheck quebra após mudança em migration:** rode `npm run gen:types` (precisa credenciais Supabase) e commite `types.ts`.
- **pgTAP falha em INSERT em auth.users:** prefixe com `SET LOCAL session_replication_role = 'replica';`.
- **Build falha por bundle size:** veja `scripts/check-bundle-size.mjs`. Use `BUDGET_OVERRIDE=relaxed` em emergência.
- **MFA challenge não aparece:** confirme `mfaCurrentLevel` no AuthContext. Sessão pode estar em AAL1.
