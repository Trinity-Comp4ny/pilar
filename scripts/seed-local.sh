#!/usr/bin/env bash
# Seed de desenvolvimento local: cria a empresa demo e o usuário owner que loga
# por email/senha no Supabase local. Idempotente.
#
#   Login:  dev@local.test  /  123456
#
# Roda o SQL como supabase_admin (superuser), porque criar o usuário exige
# desligar o trigger on_auth_user_created, o que o role postgres não pode fazer.
# Por isso NÃO fica em supabase/seed.sql (o CLI rodaria como postgres e falharia).
set -euo pipefail

REF="$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
CONTAINER="supabase_db_${REF}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Banco local não está rodando ($CONTAINER). Rode 'supabase start' antes." >&2
  exit 1
fi

docker exec -i -e PGPASSWORD=postgres "$CONTAINER" psql -U supabase_admin -d postgres < scripts/seed-local.sql

echo "Seed aplicado. Login: dev@local.test / 123456"
