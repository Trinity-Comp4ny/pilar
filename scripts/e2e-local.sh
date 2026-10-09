#!/usr/bin/env bash
# E2E do app contra o Supabase LOCAL: o mesmo comando roda na máquina do dev e no
# CI de todo PR (job "E2E (Supabase local)" do ci.yml).
#
# Por que local e não staging: PR não pode mutar o banco compartilhado de staging,
# e o banco local nasce das migrations do próprio PR, então o teste pega a
# combinação "front novo + schema novo" antes do merge, não depois do deploy.
#
# Pré-requisito: `supabase start` (o `npm run dev` já sobe). Os seeds são idempotentes.
#   npm run test:e2e:local                     # specs do app (sem e com login)
#   npm run test:e2e:local -- e2e/login.spec.ts # repassa args ao Playwright
set -euo pipefail

if ! supabase status >/dev/null 2>&1; then
  echo "Supabase local não está rodando. Rode 'supabase start' (ou 'npm run dev') antes." >&2
  exit 1
fi

# seed-local: empresa e usuários de teste. seed-demo: dados que os fluxos de escrita
# precisam (categoria financeira, cliente, disciplina); sem ele o banco zerado do CI
# não tem opção no select de categoria e o spec de receita trava.
bash scripts/seed-local.sh
bash scripts/seed-demo.sh

# Rodar a suíte algumas vezes seguidas estoura o rate limit de login (5 a 10
# tentativas por e-mail/IP em 15 min) e os specs de login passam a falhar sem
# mensagem. Banco local de dev, então zera os contadores de login antes de rodar.
REF="$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
docker exec -i -e PGPASSWORD=postgres "supabase_db_${REF}" psql -U postgres -d postgres -q -c \
  "delete from public.rate_limit_attempts where key like 'login_attempt%' or key like 'portal_login%';"

# Aprovar aditivo é definitivo, e o spec aditivo-authenticated aprova o do seed de
# demo. Para rodar de novo, o aditivo volta a pendente e o contrato ao valor do seed.
docker exec -i -e PGPASSWORD=postgres "supabase_db_${REF}" psql -U postgres -d postgres -q -c \
  "update public.escopos set status = 'pendente_aprovacao', aprovado_por = null, aprovado_em = null
     where id = '00000000-0000-0000-0000-000000000422';
   update public.projetos set valor_contrato = 320000
     where id = '00000000-0000-0000-0000-000000000401';"

# `supabase status -o env` imprime API_URL=... e ANON_KEY=... (entre aspas).
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY)=')"

export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
# Erro provocado por teste não vai para o Sentry de ninguém.
export VITE_SENTRY_DSN=""
export E2E_TEST_EMAIL="dev@local.test"
export E2E_TEST_PASSWORD="123456"
# Banco com o seed de demo: specs que dependem dele (aditivo) só rodam com isto.
export E2E_SEED_DEMO="1"
# Conta do Portal do Cliente criada pelo seed-demo.
export E2E_PORTAL_EMAIL="portal@local.test"
export E2E_PORTAL_PASSWORD="123456"
# Porta própria: não briga com um `npm run preview` aberto em 4173.
export PORT="${PORT:-4174}"

npm run build

# Regressão visual primeiro, com o banco recém-semeado e antes de qualquer spec
# criar dado. Só em Linux (referência gerada no CI; ver e2e/visual/README.md).
# E2E_VISUAL_ATUALIZAR=1 regrava as referências em vez de comparar.
if [ "$(uname)" = "Linux" ] && [ $# -eq 0 ]; then
  if [ "${E2E_VISUAL_ATUALIZAR:-}" = "1" ]; then
    npx playwright test --project=visual --update-snapshots
  else
    npx playwright test --project=visual
  fi
fi

# chromium = specs sem login; authenticated = specs logados (dependem do setup).
# O projeto "marketing" fica de fora: testa o site em produção, não este commit.
npx playwright test --project=chromium --project=authenticated "$@"
