#!/usr/bin/env bash
#
# Higiene dos commits de um PR (job "Commits do PR" do ci.yml).
#
# O merge em staging é por rebase (CLAUDE.md): cada commit do PR entra no histórico
# como está. Então um "wip", um "fixup!" esquecido ou uma mensagem fora do padrão vira
# histórico permanente. Este check reprova antes do merge.
#
# Regras:
# - assunto no padrão convencional: tipo(escopo opcional): descrição
#   tipos: feat fix chore docs style refactor perf test build ci revert
#   (o Dependabot usa "chore(deps)(deps-dev): ..." e passa; "Revert \"...\"" do git também)
# - nada de fixup!/squash!/amend! (rebase --autosquash esquecido) nem wip
# - merge commit dentro do PR vira aviso: o rebase merge descarta, mas indica branch
#   atualizada com "Update branch" em vez de rebase.
#
# Entrada (env): COMMITS_JSON = saída de `gh api repos/R/pulls/N/commits`
# ([{sha, commit: {message}, parents: [...]}]).
set -euo pipefail

: "${COMMITS_JSON:?}"

TIPOS='feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert'
erros=0

while IFS=$'\t' read -r sha pais assunto; do
  curto="${sha:0:8}"
  if [ "$pais" -gt 1 ]; then
    echo "::warning::$curto é merge commit (\"$assunto\"). O rebase merge descarta, mas prefira 'git rebase origin/staging' a 'Update branch'."
    continue
  fi
  if printf '%s' "$assunto" | grep -qE '^(fixup|squash|amend)! '; then
    echo "::error::$curto: \"$assunto\" é um $(printf '%s' "$assunto" | cut -d'!' -f1)! esquecido. Rode 'git rebase -i --autosquash origin/staging'."
    erros=$((erros + 1))
    continue
  fi
  if printf '%s' "$assunto" | grep -qiE '^wip\b|^(feat|fix|chore)(\([^)]*\))?: wip\b'; then
    echo "::error::$curto: \"$assunto\" é commit de trabalho em andamento. Junte com o commit certo antes do merge."
    erros=$((erros + 1))
    continue
  fi
  if printf '%s' "$assunto" | grep -qE "^Revert \""; then
    continue
  fi
  if ! printf '%s' "$assunto" | grep -qE "^($TIPOS)(\([^)]+\))*!?: \S"; then
    echo "::error::$curto: \"$assunto\" fora do padrão 'tipo(escopo): descrição' (tipos: ${TIPOS//|/, })."
    erros=$((erros + 1))
  fi
done < <(printf '%s' "$COMMITS_JSON" | jq -r '.[] | "\(.sha)\t\(.parents | length)\t\(.commit.message | split("\n")[0])"')

total="$(printf '%s' "$COMMITS_JSON" | jq 'length')"
if [ "$erros" -gt 0 ]; then
  echo "::error::$erros de $total commit(s) precisam de ajuste. Como o merge é por rebase, eles entrariam assim no histórico de staging."
  exit 1
fi
echo "$total commit(s) no padrão."
