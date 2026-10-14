#!/usr/bin/env bash
#
# backup-restore-test.sh
#
# DR drill: restaura um backup completo num banco Supabase descartável e prova que ele
# volta inteiro: cada tabela com o mesmo número de linhas do manifesto, RLS ligado nas
# tabelas críticas e funções de segurança presentes.
#
# Uso:
#   ./scripts/backup-restore-test.sh <PASTA_DO_BACKUP> <TEST_DB_URL>
#
# A pasta é o backup descriptografado do backup-nightly.yml:
#   roles.sql      supabase db dump --role-only
#   schema.sql     supabase db dump
#   data.sql       supabase db dump --data-only --use-copy
#   manifesto.json node scripts/backup/manifesto.mjs data.sql
#
# TEST_DB_URL tem que ser um Supabase VAZIO (projeto descartável ou `supabase start`
# num diretório sem migrations): o restore cria as tabelas do zero.
#
# Convenções:
#   - Sai com 0 se TUDO passou (última linha "OK").
#   - Sai com 1 se algo falhou (lista de "FAIL").
#   - Imprime só contagens e nomes de tabela, nunca dado: roda no CI com dado de produção.
#   - bash 3.2 (o do macOS): sem `declare -A`.

set -euo pipefail

BACKUP_DIR="${1:-}"
TEST_DB_URL="${2:-}"

if [[ -z "$BACKUP_DIR" || -z "$TEST_DB_URL" ]]; then
    echo "Uso: $0 <PASTA_DO_BACKUP> <TEST_DB_URL>" >&2
    exit 1
fi

for f in roles.sql schema.sql data.sql manifesto.json; do
    if [[ ! -f "$BACKUP_DIR/$f" ]]; then
        echo "FAIL: $BACKUP_DIR/$f não encontrado" >&2
        exit 1
    fi
done

if ! command -v psql >/dev/null 2>&1; then
    echo "FAIL: psql não está instalado (brew install libpq)" >&2
    exit 1
fi

# Safety: nunca restaurar em cima de produção ou staging (refs dos dois projetos).
# Projeto hospedado novo e vazio é permitido: é o caminho de um desastre real.
if [[ "$TEST_DB_URL" == *"vepnsonbnsimqcsfcagm"* || "$TEST_DB_URL" == *"rizaklgstyfrwgmdsldf"* ]]; then
    echo "FAIL: TEST_DB_URL aponta para produção ou staging. Use um banco vazio." >&2
    exit 1
fi

START_TS=$(date +%s)
LOG_FILE=$(mktemp -t pilar-restore-XXXXXX)
echo "Log de restore: $LOG_FILE"

# ---- restore ----------------------------------------------------------------
# Receita da documentação do Supabase: tudo numa transação, e os dados com
# session_replication_role = replica (sem trigger nem checagem de FK na carga, a ordem
# das tabelas no dump não importa).
#
# Constraint NOT VALID (ex.: receitas_valor_positivo) não valida as linhas antigas, mas
# CHECK vale em todo INSERT/COPY, então uma linha antiga fora da regra barrava o restore
# inteiro (achado no primeiro drill de produção, 2026-10-09). Elas saem antes da carga e
# voltam depois, ainda NOT VALID: o mesmo estado de produção.
GUARDAR_NOT_VALID="CREATE TEMP TABLE _not_valid AS
  SELECT k.conrelid::regclass::text AS tabela, k.conname, pg_get_constraintdef(k.oid) AS def
  FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid
  WHERE NOT k.convalidated AND k.contype IN ('c', 'f')
    AND pg_get_userbyid(t.relowner) = current_user;
DO \$\$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM _not_valid LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabela, r.conname);
  END LOOP;
END \$\$;"
RECRIAR_NOT_VALID="DO \$\$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM _not_valid LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tabela, r.conname, r.def);
  END LOOP;
END \$\$;"

echo ">> Restaurando roles, schema e dados..."
if ! psql "$TEST_DB_URL" \
        --single-transaction \
        --variable ON_ERROR_STOP=1 \
        --quiet \
        --file "$BACKUP_DIR/roles.sql" \
        --file "$BACKUP_DIR/schema.sql" \
        --command "$GUARDAR_NOT_VALID" \
        --command 'SET session_replication_role = replica' \
        --file "$BACKUP_DIR/data.sql" \
        --command 'SET session_replication_role = origin' \
        --command "$RECRIAR_NOT_VALID" \
        >>"$LOG_FILE" 2>&1; then
    echo "FAIL: psql restore retornou erro. Últimas linhas do log:" >&2
    tail -n 30 "$LOG_FILE" >&2
    exit 1
fi
RESTORE_DURATION=$(( $(date +%s) - START_TS ))
echo "   restore concluído em ${RESTORE_DURATION}s"

run_query() {
    psql "$TEST_DB_URL" -At -c "$1"
}

FAILS=()

# ---- contagens contra o manifesto ------------------------------------------
echo ">> Comparando contagens com o manifesto..."
TABELAS_OK=0
LINHAS_RESTAURADAS=0
while IFS=$'\t' read -r tabela esperado; do
    [[ -z "$tabela" ]] && continue
    schema="${tabela%%.*}"
    nome="${tabela#*.}"
    if ! obtido=$(run_query "SELECT count(*) FROM \"$schema\".\"$nome\";" 2>>"$LOG_FILE"); then
        FAILS+=("$tabela não existe depois do restore")
        continue
    fi
    if [[ "$obtido" != "$esperado" ]]; then
        FAILS+=("$tabela: $obtido linhas, manifesto diz $esperado")
        continue
    fi
    TABELAS_OK=$((TABELAS_OK + 1))
    LINHAS_RESTAURADAS=$((LINHAS_RESTAURADAS + obtido))
done < <(node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const [t, n] of Object.entries(m.tabelas)) console.log(`${t}\t${n}`);
' "$BACKUP_DIR/manifesto.json")
echo "   $TABELAS_OK tabelas conferidas, $LINHAS_RESTAURADAS linhas"

for tbl in auth.users public.empresas public.profiles; do
    n=$(run_query "SELECT count(*) FROM $tbl;" 2>>"$LOG_FILE" || echo 0)
    printf "   %-18s %s linhas\n" "$tbl" "$n"
    if [[ "$n" -le 0 ]]; then
        FAILS+=("$tbl vazia: backup sem dados")
    fi
done

# ---- RLS --------------------------------------------------------------------
echo ">> Validando RLS habilitado..."
RLS_TABLES=(profiles empresas projetos receitas despesas data_deletion_requests audit_logs)
for tbl in "${RLS_TABLES[@]}"; do
    rls=$(run_query "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.$tbl'::regclass;" 2>>"$LOG_FILE" || echo "")
    if [[ "$rls" != "t" ]]; then
        FAILS+=("RLS desabilitado (ou tabela ausente) em $tbl")
    fi
done

# ---- funções ----------------------------------------------------------------
echo ">> Validando funções críticas..."
for fn in has_role get_user_empresa_id can_view_financeiro request_data_deletion; do
    exists=$(run_query "SELECT 1 FROM pg_proc WHERE proname = '$fn' LIMIT 1;" 2>>"$LOG_FILE" || echo "")
    if [[ "$exists" != "1" ]]; then
        FAILS+=("função $fn não encontrada")
    fi
done

# ---- relatório --------------------------------------------------------------
TOTAL_DURATION=$(( $(date +%s) - START_TS ))
echo ""
echo "================ DR drill ================"
echo "Restore:  ${RESTORE_DURATION}s   Total: ${TOTAL_DURATION}s"
echo "Tabelas:  $TABELAS_OK conferidas, $LINHAS_RESTAURADAS linhas"
echo "=========================================="

if [[ "${#FAILS[@]}" -gt 0 ]]; then
    echo ""
    for f in "${FAILS[@]}"; do
        echo "FAIL: $f"
    done
    exit 1
fi

echo "OK"
