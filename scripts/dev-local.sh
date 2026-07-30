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

echo "▶ servindo Edge Functions + Vite — Ctrl+C encerra os dois."
supabase functions serve &
FUNCS_PID=$!
npm run dev &
VITE_PID=$!

trap 'echo; echo "▶ encerrando…"; kill "$FUNCS_PID" "$VITE_PID" 2>/dev/null || true' INT TERM
wait
