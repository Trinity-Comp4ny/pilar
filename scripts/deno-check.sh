#!/usr/bin/env bash
#
# `deno check` nas Edge Functions, com ratchet.
#
# As 44 funções nunca tiveram verificação de compilação: erro de tipo ou import
# quebrado só aparecia no cold start, em produção. Ligar o check de uma vez
# reprovaria o repo por 12 erros pré-existentes, então a dívida conhecida vive em
# supabase/functions/TYPECHECK_DEBT.txt e o resto é bloqueante.
#
# Uso: scripts/deno-check.sh
set -uo pipefail

DEBT_FILE="supabase/functions/TYPECHECK_DEBT.txt"

# Sem mapfile nem globstar: o bash do macOS é 3.2, e um script de CI que só roda
# no runner é um script que ninguém consegue depurar antes de fazer push.
DEBT="$(grep -vE '^[[:space:]]*(#|$)' "$DEBT_FILE" | tr -d '\r')"

is_debt() {
  printf '%s\n' "$DEBT" | grep -qxF "$1"
}

clean=""
debt=""
for f in supabase/functions/*/index.ts; do
  [ -e "$f" ] || continue
  if is_debt "$f"; then
    debt="$debt $f"
  else
    clean="$clean $f"
  fi
done

# shellcheck disable=SC2086 # word splitting é o que queremos: lista de paths
echo "→ $(printf '%s' "$clean" | wc -w | tr -d ' ') função(ões) no gate bloqueante, $(printf '%s' "$debt" | wc -w | tr -d ' ') com dívida conhecida"

status=0

if [ -n "$clean" ]; then
  echo ""
  echo "== Gate bloqueante =="
  # shellcheck disable=SC2086
  if ! deno check $clean; then
    echo "::error::deno check falhou numa função que estava limpa. Isso é regressão, não dívida antiga."
    status=1
  fi
fi

if [ -n "$debt" ]; then
  echo ""
  echo "== Dívida conhecida (informativo, não reprova) =="
  # Cada uma isolada: uma função que passou a compilar aparece no log e pode sair
  # da lista, que é como o ratchet aperta.
  for f in $debt; do
    if deno check "$f" >/dev/null 2>&1; then
      echo "::notice::$f agora compila limpo. Remova a linha dele de $DEBT_FILE."
    else
      echo "  ainda com erro de tipo: $f"
    fi
  done
fi

exit "$status"
