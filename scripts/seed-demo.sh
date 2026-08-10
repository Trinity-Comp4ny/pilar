#!/usr/bin/env bash
# Popula o ambiente local com dados de demonstração (comercial, projetos,
# financeiro, obras) para a empresa/admin criados por seed-local. Idempotente.
# Roda como postgres (não mexe em auth), então dispensa superuser.
set -euo pipefail

REF="$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
CONTAINER="supabase_db_${REF}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Banco local não está rodando ($CONTAINER). Rode 'supabase start' antes." >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/seed-demo.sql
echo "Dados de demonstração aplicados."
