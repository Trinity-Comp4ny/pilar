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

# `supabase status -o env` imprime API_URL=... e ANON_KEY=... (entre aspas).
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY)=')"

export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
# Erro provocado por teste não vai para o Sentry de ninguém.
export VITE_SENTRY_DSN=""
export E2E_TEST_EMAIL="dev@local.test"
export E2E_TEST_PASSWORD="123456"
# Porta própria: não briga com um `npm run preview` aberto em 4173.
export PORT="${PORT:-4174}"

npm run build

# chromium = specs sem login; authenticated = specs logados (dependem do setup).
# O projeto "marketing" fica de fora: testa o site em produção, não este commit.
npx playwright test --project=chromium --project=authenticated "$@"
