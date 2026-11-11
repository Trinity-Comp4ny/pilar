#!/usr/bin/env bash
#
# Fecha as issues citadas nas mensagens dos commits de um push em staging
# (workflow fechar-issues-staging.yml). Mesma gramática do GitHub:
#   close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved #N
#
# Entrada (env):
#   COMMITS  JSON de github.event.commits ([{id, message, url}, ...])
#   REPO     owner/repo
#   GH_TOKEN token com issues:write
#   DRY_RUN  "1" só imprime o que faria (usado no teste local)
set -euo pipefail

: "${COMMITS:?}" "${REPO:?}"

# Uma linha "N<TAB>sha<TAB>url" por referência. A regex roda no jq (PCRE do
# oniguruma), sobre a mensagem inteira, case-insensitive.
REFS="$(printf '%s' "$COMMITS" | jq -r '
  .[] | . as $c
  | [ $c.message | scan("(?i)\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s*:?\\s+#([0-9]+)\\b") ]
  | .[] | "\(.[0])\t\($c.id)\t\($c.url)"' | sort -u -t$'\t' -k1,1n)"

if [ -z "$REFS" ]; then
  echo "Nenhum commit deste push cita issue para fechar."
  exit 0
fi

while IFS=$'\t' read -r numero sha url; do
  if [ "${DRY_RUN:-}" = "1" ]; then
    echo "fecharia #$numero (commit ${sha:0:8})"
    continue
  fi
  # /issues/N também devolve PR; o campo pull_request diferencia.
  info="$(gh api "repos/$REPO/issues/$numero" --jq '{state: .state, pr: (.pull_request != null)}' 2>/dev/null || true)"
  if [ -z "$info" ]; then
    echo "#$numero não existe ou não é acessível. Ignorado."
    continue
  fi
  if [ "$(printf '%s' "$info" | jq -r .pr)" = "true" ]; then
    echo "#$numero é PR, não issue. Ignorado."
    continue
  fi
  if [ "$(printf '%s' "$info" | jq -r .state)" != "open" ]; then
    echo "#$numero já está fechada."
    continue
  fi
  gh issue close "$numero" --repo "$REPO" --reason completed \
    --comment "Resolvida por ${url} (\`${sha:0:8}\`), que entrou em \`staging\`. Chega em produção no próximo release."
  echo "::notice::Issue #$numero fechada (commit ${sha:0:8})."
done <<<"$REFS"
