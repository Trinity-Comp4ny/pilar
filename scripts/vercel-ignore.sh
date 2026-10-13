#!/usr/bin/env bash
#
# ignoreCommand dos dois projetos Vercel (app na raiz, landing em apps/marketing).
# Saída 0 = pula o build; 1 = builda. A Vercel executa no Root Directory do projeto,
# por isso todo pathspec é de topo (:/...), e a lógica mora aqui e não no vercel.json
# (limite de 256 caracteres no ignoreCommand).
#
# Produção sempre builda. Prévia só builda se o commit mexeu no que vai para o bundle
# daquele projeto: PR de Edge Function, migration, doc, teste ou workflow não gasta
# build (crédito de Vercel acabou em 13/10 com dezenas de prévias assim).
# Na dúvida (git falhou, commit base indisponível), builda.

set -u
alvo="${1:-}"

[ "${VERCEL_ENV:-}" = "production" ] && exit 1

base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "$base" 2>/dev/null || git fetch -q --depth=1 origin "$base" 2>/dev/null || exit 1

case "$alvo" in
  app)
    caminhos=(":/")
    for fora in apps/marketing supabase docs e2e tests .github research brand .claude "*.md"; do
      caminhos+=(":(top,exclude)$fora")
    done
    ;;
  marketing)
    caminhos=(":/apps/marketing" ":/package-lock.json")
    ;;
  *)
    echo "uso: vercel-ignore.sh app|marketing" >&2
    exit 1
    ;;
esac

if git diff --quiet "$base" HEAD -- "${caminhos[@]}"; then
  echo "Sem mudança que afete o bundle de $alvo: build pulado."
  exit 0
fi
exit 1
