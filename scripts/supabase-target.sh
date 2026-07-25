#!/usr/bin/env bash
#
# Wrapper de comando destrutivo da CLI do Supabase com ambiente OBRIGATÓRIO.
#
# Motivo: `supabase db push` sem --db-url usa o project_id do config.toml. Enquanto
# esse valor apontava para produção (até 2026-07-25), o comando mais natural de
# digitar era também o mais perigoso. Este script torna o ambiente um argumento
# obrigatório e exige opt-in nomeado para produção. Ver ADR 0007.
#
# Uso:
#   scripts/supabase-target.sh push     staging|prod
#   scripts/supabase-target.sh deploy   staging|prod
#   scripts/supabase-target.sh types    staging|prod [arquivo_de_saida]
#
# Env esperado (por ambiente, nunca comitado):
#   SUPABASE_DB_URL_STAGING / SUPABASE_DB_URL_PROD     URI do Session Pooler (IPv4)
#   SUPABASE_PROJECT_REF_STAGING / SUPABASE_PROJECT_REF_PROD
#
# Produção exige também: ALLOW_PROD_DB_PUSH=true
set -euo pipefail

ACTION="${1:-}"
ENVIRONMENT="${2:-}"

die() {
  echo "erro: $*" >&2
  exit 1
}

case "$ACTION" in
push | deploy | types) ;;
*) die "ação inválida '${ACTION:-<vazio>}'. Use: push | deploy | types" ;;
esac

case "$ENVIRONMENT" in
staging)
  DB_URL="${SUPABASE_DB_URL_STAGING:-}"
  PROJECT_REF="${SUPABASE_PROJECT_REF_STAGING:-rizaklgstyfrwgmdsldf}"
  ;;
prod)
  DB_URL="${SUPABASE_DB_URL_PROD:-}"
  PROJECT_REF="${SUPABASE_PROJECT_REF_PROD:-vepnsonbnsimqcsfcagm}"
  # Opt-in nomeado, não interativo: funciona em terminal e em CI, e fica no
  # histórico do shell de quem rodou. Só para as ações que MUTAM prod: gerar
  # tipos é leitura e não precisa de cerimônia.
  if [ "$ACTION" != "types" ] && [ "${ALLOW_PROD_DB_PUSH:-}" != "true" ]; then
    die "alvo é PRODUÇÃO. Se é intencional, rode com ALLOW_PROD_DB_PUSH=true"
  fi
  ;;
*) die "ambiente inválido '${ENVIRONMENT:-<vazio>}'. Use: staging | prod" ;;
esac

echo "→ ambiente: $ENVIRONMENT (ref: $PROJECT_REF)"

case "$ACTION" in
push)
  [ -n "$DB_URL" ] || die "falta a variável de ambiente com a URI do banco de $ENVIRONMENT"
  # --db-url aponta pro Session Pooler (IPv4). A conexão direta do Supabase é
  # IPv6-only e falha em runner IPv4-only.
  exec supabase db push --db-url "$DB_URL"
  ;;
deploy)
  # Sem nome de função = deploya todas, respeitando verify_jwt por função do config.toml.
  exec supabase functions deploy --project-ref "$PROJECT_REF"
  ;;
types)
  OUT="${3:-}"
  if [ -z "$OUT" ]; then
    exec supabase gen types typescript --project-id "$PROJECT_REF"
  fi
  # Escrita atômica: `supabase gen types > arquivo` trunca o destino antes de saber
  # se o comando funciona, então uma falha de rede deixava types.ts vazio e o
  # typecheck quebrava em 400 arquivos sem relação com a causa.
  TMP="$(mktemp)"
  trap 'rm -f "$TMP"' EXIT
  supabase gen types typescript --project-id "$PROJECT_REF" >"$TMP"
  [ -s "$TMP" ] || die "a CLI devolveu saída vazia; $OUT foi preservado"
  mv "$TMP" "$OUT"
  trap - EXIT
  echo "→ tipos gravados em $OUT"
  ;;
esac
