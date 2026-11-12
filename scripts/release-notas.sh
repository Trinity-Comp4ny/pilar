#!/usr/bin/env bash
# Manda os commits de um release para virar rascunho de novidades (SPEC 152).
#
#   FORMATO='%x1e%H%n%B' scripts/feedback-release-commits.sh <release> <antes> \
#     | scripts/release-notas.sh <sha-do-release>
#
# Entrada: registros separados por \x1e, cada um com o sha na primeira linha e a mensagem depois.
# Só sobem os commits com linha Novidade: (o resto é interno).
# A edge release-rascunho lê as linhas Novidade:/Impacto:/Modulo:/Feedback: e grava o rascunho.
# Sem RELEASE_NOTAS_URL/RELEASE_NOTAS_TOKEN só avisa e sai com 0 (não derruba o release de quem
# ainda não configurou os segredos). RELEASE_NOTAS_DRY_RUN=1 só imprime o corpo.
set -euo pipefail

sha="${1:-}"
if ! [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "uso: release-notas.sh <sha-do-release>" >&2
  exit 2
fi

corpo=$(jq -Rs --arg sha "$sha" '
  split("\u001e")
  | map(select(test("\\S")))
  | map(sub("^\n+"; "") | split("\n") as $l | {sha: ($l[0] | gsub("\\s"; "")), mensagem: ($l[1:] | join("\n"))})
  | map(select(.mensagem | test("(^|\n)Novidade:"; "i")))
  | {sha: $sha, commits: .}')

total=$(printf '%s' "$corpo" | jq '.commits | length')
if [ "$total" = "0" ]; then
  echo "Nenhum commit com linha Novidade: neste release."
  exit 0
fi

if [ "${RELEASE_NOTAS_DRY_RUN:-}" = "1" ]; then
  printf '%s\n' "$corpo"
  exit 0
fi

if [ -z "${RELEASE_NOTAS_URL:-}" ] || [ -z "${RELEASE_NOTAS_TOKEN:-}" ]; then
  echo "::warning::RELEASE_NOTAS_URL ou RELEASE_NOTAS_TOKEN ausente: novidades do release não gravadas ($total commit(s) com Novidade:)."
  exit 0
fi

curl -fsS -X POST "$RELEASE_NOTAS_URL" \
  -H "Authorization: Bearer $RELEASE_NOTAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$corpo"
echo
