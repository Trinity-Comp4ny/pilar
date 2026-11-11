#!/usr/bin/env bash
#
# Espera o `supabase start` que o ci.yml dispara em segundo plano e devolve o
# resultado dele. Assim o pull das imagens (~1 min) corre em paralelo com a
# instalação do Node e do Playwright, em vez de antes delas.
#
# O passo que dispara grava a saída em $RUNNER_TEMP/supabase-start.log e o exit
# code em $RUNNER_TEMP/supabase-start.rc quando termina. Só faz sentido no CI.
set -euo pipefail

DIR="${RUNNER_TEMP:-/tmp}"
RC_FILE="$DIR/supabase-start.rc"
LOG_FILE="$DIR/supabase-start.log"
LIMITE_S="${SUPABASE_START_TIMEOUT_S:-600}"

espera=0
while [ ! -s "$RC_FILE" ]; do
  if [ "$espera" -ge "$LIMITE_S" ]; then
    echo "::error::supabase start não terminou em ${LIMITE_S}s."
    cat "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi
  sleep 2
  espera=$((espera + 2))
done

rc="$(cat "$RC_FILE")"
echo "::group::Log do supabase start (exit $rc, esperou ${espera}s aqui)"
cat "$LOG_FILE" 2>/dev/null || true
echo "::endgroup::"

if [ "$rc" != "0" ]; then
  echo "::error::supabase start falhou (exit $rc). O log está no grupo acima."
  exit "$rc"
fi
