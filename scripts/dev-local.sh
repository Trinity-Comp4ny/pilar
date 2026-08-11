#!/usr/bin/env bash
# Sobe TODO o ambiente local com um comando: Supabase (Docker) + Edge Functions + Vite.
#
# Por que este script existe: `supabase start` sobe a infra local (Postgres, Auth,
# Storage, Realtime, Kong), mas NÃO serve as Edge Functions de forma persistente —
# elas são servidas por `supabase functions serve` (com hot-reload), à parte. Sem esse
# processo, a rota /functions/v1/* responde 503 e o chat (ai-chat) quebra localmente.
# Este script orquestra os três e encerra os dois processos long-running juntos no Ctrl+C.
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
# assim toda migration nova entra sozinha ao rodar `npm run dev:local`.
echo "▶ aplicando migrations pendentes no banco local…"
supabase migration up --local

echo "▶ servindo Edge Functions + Vite — Ctrl+C encerra os dois."
supabase functions serve &
FUNCS_PID=$!
npm run dev &
VITE_PID=$!

trap 'echo; echo "▶ encerrando…"; kill "$FUNCS_PID" "$VITE_PID" 2>/dev/null || true' INT TERM
wait
