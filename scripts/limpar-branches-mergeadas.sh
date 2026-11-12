#!/usr/bin/env bash
#
# Apaga branches remotas cujo PR já foi MERGEADO (workflow limpar-branches.yml).
# Regra do CLAUDE.md: entre trabalhos só sobrevivem `main` e `staging`. O
# `--delete-branch` do merge cobre o caso normal; isto pega o que escapou (merge
# pela interface, branch recriada, PR antigo).
#
# Só apaga com prova de que o trabalho está a salvo: o PR mais recente da branch
# está MERGED e a ponta da branch é o mesmo commit que foi mergeado (ninguém
# empurrou nada depois). Branch sem PR, com PR aberto ou fechado sem merge fica, e
# vai para o relatório do resumo do run.
#
# Entrada (env): REPO (owner/repo), GH_TOKEN, DRY_RUN=1 só lista.
# Teste local: BRANCHES_JSON e PRS_JSON_<branch-sanitizada> substituem a API.
set -euo pipefail

: "${REPO:?}"
PROTEGIDAS='^(main|staging|pr-assets|gh-pages)$'
RESUMO="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

listar_branches() {
  if [ -n "${BRANCHES_JSON:-}" ]; then printf '%s' "$BRANCHES_JSON"; return; fi
  gh api --paginate "repos/$REPO/branches?per_page=100" --jq '[.[] | {name, sha: .commit.sha}]' | jq -s 'add'
}

prs_da_branch() {
  local branch="$1"
  local var="PRS_JSON_$(printf '%s' "$branch" | tr -c 'a-zA-Z0-9' '_')"
  if [ -n "${!var:-}" ]; then printf '%s' "${!var}"; return; fi
  if [ -n "${BRANCHES_JSON:-}" ]; then echo '[]'; return; fi
  # head=owner:branch filtra PRs desta branch no próprio repo (fork não entra).
  gh api "repos/$REPO/pulls?state=all&head=${REPO%%/*}:${branch}&per_page=5&sort=updated&direction=desc" \
    --jq '[.[] | {number, merged: (.merged_at != null), state, head_sha: .head.sha}]'
}

apagadas=()
mantidas=()

while IFS=$'\t' read -r nome sha; do
  [ -z "$nome" ] && continue
  if printf '%s' "$nome" | grep -qE "$PROTEGIDAS"; then continue; fi
  pr="$(prs_da_branch "$nome" | jq -c '.[0] // empty')"
  if [ -z "$pr" ]; then
    mantidas+=("\`$nome\`: sem PR")
    continue
  fi
  numero="$(jq -r .number <<<"$pr")"
  if [ "$(jq -r .merged <<<"$pr")" != "true" ]; then
    mantidas+=("\`$nome\`: PR #$numero $(jq -r .state <<<"$pr") sem merge")
    continue
  fi
  if [ "$(jq -r .head_sha <<<"$pr")" != "$sha" ]; then
    mantidas+=("\`$nome\`: PR #$numero mergeado, mas a branch recebeu commits depois")
    continue
  fi
  if [ "${DRY_RUN:-}" = "1" ]; then
    apagadas+=("\`$nome\` (PR #$numero) [dry-run]")
    continue
  fi
  gh api -X DELETE "repos/$REPO/git/refs/heads/$nome" >/dev/null
  apagadas+=("\`$nome\` (PR #$numero)")
done < <(listar_branches | jq -r '.[] | "\(.name)\t\(.sha)"')

{
  echo "### Limpeza de branches"
  echo ""
  echo "**Apagadas (${#apagadas[@]})**: PR mergeado e nada novo na branch."
  for b in ${apagadas[@]+"${apagadas[@]}"}; do echo "- $b"; done
  echo ""
  echo "**Mantidas (${#mantidas[@]})**: revisar à mão se ainda servem."
  for b in ${mantidas[@]+"${mantidas[@]}"}; do echo "- $b"; done
} >>"$RESUMO"
