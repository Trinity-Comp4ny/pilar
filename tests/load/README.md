# Pilar — Load Testing com k6

Suite de testes de carga para os fluxos críticos do Pilar. Roda com [k6](https://k6.io/) contra um ambiente de teste (Supabase local ou sandbox).

## AVISO CRITICO

**NUNCA rode estes testes contra producao.**

- 100+ VUs concorrentes podem disparar rate-limit do Supabase, gerar custo, ou corromper dados.
- Os scripts criam e deletam dados reais (lancamentos com prefixo `LoadTest`).
- Use sempre `supabase start` (local) ou um projeto Supabase dedicado a sandbox.

## Instalacao

```bash
# macOS
brew install k6

# Linux
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Verificar: `k6 version`.

## Variaveis de ambiente

Crie um `.env.loadtest` (NAO commitar) ou exporte direto:

| Variavel                 | Descricao                                 | Exemplo                  |
| ------------------------ | ----------------------------------------- | ------------------------ |
| `K6_BASE_URL`            | URL da app (frontend)                     | `http://localhost:8080`  |
| `K6_SUPABASE_URL`        | URL do Supabase                           | `http://localhost:54321` |
| `K6_SUPABASE_KEY`        | anon key do projeto de teste              | `eyJhbGciOi...`          |
| `K6_TEST_EMAIL`          | usuario de teste com dados seedados       | `loadtest@pilar.local`   |
| `K6_TEST_PASSWORD`       | senha do usuario de teste                 | `changeme`               |
| `K6_ASAAS_WEBHOOK_TOKEN` | token usado pela edge function de webhook | `whk_xxx`                |

Carregar: `set -a; source .env.loadtest; set +a`.

## Como rodar

```bash
# Cenario individual
k6 run tests/load/scenarios/login.js
k6 run tests/load/scenarios/dashboard-read.js
k6 run tests/load/scenarios/criar-receita.js
k6 run tests/load/scenarios/listar-lancamentos.js
k6 run tests/load/scenarios/webhook-asaas.js

# Com saida JSON para analise posterior
k6 run --out json=results/login-$(date +%s).json tests/load/scenarios/login.js

# Override pontual de VUs/duracao (debug rapido)
k6 run --vus 10 --duration 30s tests/load/scenarios/dashboard-read.js
```

## Cenarios

| Arquivo                 | O que testa                                      | VUs alvo |
| ----------------------- | ------------------------------------------------ | -------- |
| `login.js`              | 100 logins concorrentes — rate limit + Auth      | 100      |
| `dashboard-read.js`     | GETs do dashboard — RLS + cache                  | 100      |
| `criar-receita.js`      | POST `/rest/v1/lancamentos` — writes + triggers  | 100      |
| `listar-lancamentos.js` | GET com paginacao e filtros — indexes            | 100      |
| `webhook-asaas.js`      | 500 webhook calls — idempotencia + edge function | 500      |

## Thresholds (default)

- `http_req_duration p(95) < 500ms` (webhook: 800ms)
- `http_req_failed < 1%`
- `errors < 10` (counter customizado)

Falhar qualquer threshold faz o `k6 run` retornar exit code != 0 — integravel a CI.

## Estrutura

```
tests/load/
  scenarios/   # um arquivo por fluxo critico
  utils/
    setup.js   # config + thresholds + stages padrao
    auth.js    # helper authenticate() para login Supabase
```

## Setup do ambiente de teste

1. `supabase start` (Supabase local).
2. Aplicar migrations: `supabase db reset`.
3. Seedar usuario de teste:
   ```sql
   -- via Supabase Studio ou psql
   insert into auth.users (email, encrypted_password) values (...);
   ```
4. Exportar env vars apontando para `http://localhost:54321`.

## Veja tambem

- `docs/operations/load-testing.md` — estrategia, quando rodar, baseline.
