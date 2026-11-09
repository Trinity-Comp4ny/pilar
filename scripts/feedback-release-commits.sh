#!/usr/bin/env bash
# Mensagens dos commits de `staging` que entraram em um release (SPEC 145).
#
#   scripts/feedback-release-commits.sh <commit-do-release-em-main> <main-antes-do-release>
#
# O release é um commit só, com a árvore de `staging` (read-tree). Acha o commit de staging com essa
# mesma árvore (o topo no momento do release) e faz o mesmo com o main anterior; o intervalo entre os
# dois é o conteúdo do release. Não depende do corpo do PR (que pode ser escrito à mão).
# Sai com 3 se a árvore do release não bate com nenhum commit de staging (staging andou depois);
# quem chama cai no corpo do PR.
set -euo pipefail

release="${1:?commit do release}"
antes="${2:?main antes do release}"
staging="${STAGING_REF:-origin/staging}"

# Primeiro commit de staging (do mais novo para o mais velho) com a árvore dada. Sem `exit` no awk:
# fechar o pipe cedo faz o git log morrer com SIGPIPE e o `pipefail` derruba o script.
topo_com_arvore() {
  git log "$staging" --format='%H %T' | awk -v t="$1" '!achou && $2 == t { print $1; achou = 1 }'
}

fim=$(topo_com_arvore "$(git rev-parse "$release^{tree}")")
[ -n "$fim" ] || exit 3

inicio=$(topo_com_arvore "$(git rev-parse "$antes^{tree}")")
if [ -n "$inicio" ]; then
  git log "$inicio..$fim" --format=%B
else
  # Main anterior sem commit de staging equivalente: usa a data dele como corte.
  git log "$fim" --since="$(git show -s --format=%cI "$antes")" --format=%B
fi
