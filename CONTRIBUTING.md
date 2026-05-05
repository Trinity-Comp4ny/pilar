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

- **lint-test-build** — sempre (push e PR).
- **audit** — `npm audit --audit-level=high`.
- **secrets-scan** — gitleaks.
- **pgtap** — só em PR. Roda 9 suites cobrindo RLS + impersonation + features (~80 asserts).
- **types-sync-check** — só em PR. Garante `types.ts` em sync com migrations.
- **e2e** — só em PR. Playwright + 4 specs (segurança/redirect + skeleton autenticado).

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
- `npm run gen:types` após qualquer mudança de schema (CI valida).

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
