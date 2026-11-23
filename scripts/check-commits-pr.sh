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
# - feat/fix/perf que o cliente vê precisa da linha `Novidade: <frase>` ou `Interno: <motivo>` no
#   corpo do commit (SPEC 152). Sem isso o release sai sem novidades para o usuário. Escopos de
#   infra (ci, e2e, db, deps, types, lint, security) e tipos chore/docs/style/refactor/test/build/ci
#   não precisam. Vale para a mensagem do commit, não para o corpo do PR.
# - merge commit dentro do PR vira aviso: o rebase merge descarta, mas indica branch
#   atualizada com "Update branch" em vez de rebase.
#
# Entrada (env): COMMITS_JSON = saída de `gh api repos/R/pulls/N/commits`
# ([{sha, commit: {message}, parents: [...]}]).
set -euo pipefail

: "${COMMITS_JSON:?}"

TIPOS='feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert'
erros=0

SEM_NOVIDADE='^(ci|e2e|db|deps|deps-dev|types|lint|security|migration|infra)$'

while IFS=$'\t' read -r sha pais assunto temlinha; do
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
    continue
  fi
  tipo=$(printf '%s' "$assunto" | sed -E 's/^([a-z]+).*/\1/')
  escopo=$(printf '%s' "$assunto" | sed -nE 's/^[a-z]+\(([^)]+)\).*/\1/p')
  if [[ "$tipo" =~ ^(feat|fix|perf)$ ]] && ! [[ "$escopo" =~ $SEM_NOVIDADE ]] && [ "$temlinha" != "1" ]; then
    echo "::error::$curto: \"$assunto\" muda o que o cliente vê? Ponha no corpo do COMMIT 'Novidade: <o que o cliente ganha>' (+ 'Impacto: fluxo|melhoria|correcao'), ou 'Interno: <motivo>' se não aparece para ele."
    erros=$((erros + 1))
  fi
done < <(printf '%s' "$COMMITS_JSON" | jq -r '.[] | "\(.sha)\t\(.parents | length)\t\(.commit.message | split("\n")[0])\t\(if (.commit.message | test("(^|\n)(Novidade|Interno):"; "i")) then 1 else 0 end)"')

total="$(printf '%s' "$COMMITS_JSON" | jq 'length')"
if [ "$erros" -gt 0 ]; then
  echo "::error::$erros de $total commit(s) precisam de ajuste. Como o merge é por rebase, eles entrariam assim no histórico de staging."
  exit 1
fi
echo "$total commit(s) no padrão."
