#!/usr/bin/env bash
# Sobe TUDO com um comando: Supabase (Docker) + Edge Functions + app (Vite) + LP marketing (Vite).
#
# É o que roda por trás de `npm run dev`. Sem Docker/Supabase rodando local, use
# `npm run dev:app` (só o front do app) ou `npm run dev:all` (app+LP, sem backend).
#
# functions serve lê supabase/functions/.env automaticamente (onde vive a GEMINI_API_KEY).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ subindo Supabase local (idempotente)…"
supabase start

# Docker local tem RAM finita. Com policy = "per_worker" (config.toml), o edge_runtime
# roda num container que apanha OOM (exit 137) e crash-loopa se outro stack Supabase de
# outro projeto estiver ligado ao mesmo tempo. O sintoma é o "functions serve" cuspindo
# "No such container" em loop. Aviso cedo em vez de deixar o serve falhar silenciosamente.
OTHER_STACKS=$(docker ps --format '{{.Names}}' 2>/dev/null \
  | sed -En 's/^supabase_[a-z_]+_(.+)$/\1/p' | sort -u | grep -v '^rizaklgstyfrwgmdsldf$' || true)
if [ -n "$OTHER_STACKS" ]; then
  echo "⚠ outro(s) stack(s) Supabase rodando e disputando RAM: $(echo "$OTHER_STACKS" | tr '\n' ' ')"
  echo "  se o edge runtime falhar, pare-o(s) no diretório do outro projeto: supabase stop"
fi

# `supabase start` só aplica migrations quando CRIA o banco (1ª vez / db reset).
# Com o banco já existente, migrations novas ficam de fora até serem aplicadas.
# `migration up` aplica as pendentes de forma incremental, SEM apagar dados —
# assim toda migration nova entra sozinha ao rodar `npm run dev`.
echo "▶ aplicando migrations pendentes no banco local…"
supabase migration up --local

echo "▶ servindo Edge Functions + app + LP marketing — Ctrl+C encerra tudo."
supabase functions serve &
FUNCS_PID=$!
npm run dev:app &
APP_PID=$!
npm run dev:marketing &
MARKETING_PID=$!

trap 'echo; echo "▶ encerrando…"; kill "$FUNCS_PID" "$APP_PID" "$MARKETING_PID" 2>/dev/null || true' INT TERM
wait
