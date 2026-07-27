#!/usr/bin/env bash
#
# Repete um comando quando ele falha por erro de transporte, e só nesse caso.
#
# Motivo: `supabase functions deploy` e `deno check` resolvem imports remotos (esm.sh,
# deno.land) na hora. Um 5xx do CDN derruba o CD do backend sem que exista nada errado
# no código. Aconteceu duas vezes em sequência: run 30176697516 (deno check) e run
# 30288891918 (functions deploy), ambos com "failed: 522" do esm.sh.
#
# O filtro é deliberadamente estreito: erro de compilação, de permissão ou de SQL falha
# na primeira tentativa. Repetir esses só atrasaria o feedback e mascararia o problema.
#
# Uso: scripts/retry-on-network-error.sh <comando> [args...]
set -uo pipefail

MAX_ATTEMPTS="${RETRY_MAX_ATTEMPTS:-3}"

# Assinaturas de falha de transporte. Mantidas juntas para haver um único lugar a
# ajustar quando um registry novo aparecer com uma mensagem diferente.
NETWORK_PATTERN='failed: (5[0-9][0-9]|<unknown)|error sending request|connection closed|connection reset|dns error|Connection refused|TLS handshake|timed out|EAI_AGAIN|503 Service|502 Bad Gateway'

attempt=1
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

while :; do
  set +e
  "$@" >"$log" 2>&1
  rc=$?
  set -e
  cat "$log"

  [ "$rc" -eq 0 ] && exit 0

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "::error::'$1' falhou após $attempt tentativa(s)."
    exit "$rc"
  fi

  if ! grep -qiE "$NETWORK_PATTERN" "$log"; then
    echo "::error::'$1' falhou e não foi por rede. Não repete: veja o log acima."
    exit "$rc"
  fi

  wait=$((attempt * 15))
  echo "::warning::tentativa $attempt falhou por erro de rede; repetindo em ${wait}s"
  sleep "$wait"
  attempt=$((attempt + 1))
done
