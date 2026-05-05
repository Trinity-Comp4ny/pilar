#!/usr/bin/env bash
#
# backup-restore-test.sh
#
# DR drill: restaura um dump SQL em um banco de teste e valida invariantes
# básicas (contagens > 0, RLS habilitado em tabelas críticas).
#
# Uso:
#   ./scripts/backup-restore-test.sh <BACKUP_DUMP> <TEST_DB_URL>
#
# Exemplo:
#   ./scripts/backup-restore-test.sh \
#       backups/prod-2026-04-01.sql \
#       "postgresql://postgres.xxx:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
#
# Convenções:
#   - Sai com 0 se TUDO passou (saída final "OK").
#   - Sai com 1 se algo falhou (saída final "FAIL: <razão>").
#   - Não modifica produção; o TEST_DB_URL deve apontar para projeto descartável.

set -euo pipefail

# ---- args -------------------------------------------------------------------

BACKUP_DUMP="${1:-}"
TEST_DB_URL="${2:-}"

if [[ -z "$BACKUP_DUMP" || -z "$TEST_DB_URL" ]]; then
    echo "Uso: $0 <BACKUP_DUMP> <TEST_DB_URL>" >&2
    exit 1
fi

if [[ ! -f "$BACKUP_DUMP" ]]; then
    echo "FAIL: dump não encontrado em $BACKUP_DUMP" >&2
    exit 1
fi

DUMP_BYTES=$(wc -c <"$BACKUP_DUMP" | tr -d ' ')
if [[ "$DUMP_BYTES" -lt 1024 ]]; then
    echo "FAIL: dump muito pequeno ($DUMP_BYTES bytes), provavelmente corrompido" >&2
    exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
    echo "FAIL: psql não está instalado (brew install libpq)" >&2
    exit 1
fi

# Safety: bloquear URL apontando para hosts conhecidamente prod.
if [[ "$TEST_DB_URL" == *"pilar-prod"* || "$TEST_DB_URL" == *"production"* ]]; then
    echo "FAIL: TEST_DB_URL parece apontar para PROD. Abortando." >&2
    exit 1
fi

START_TS=$(date +%s)
LOG_FILE=$(mktemp -t pilar-restore-XXXXXX.log)
echo "Log de restore: $LOG_FILE"

# ---- restore ----------------------------------------------------------------

echo ">> Restaurando $BACKUP_DUMP em banco de teste..."
if ! psql "$TEST_DB_URL" \
        --set ON_ERROR_STOP=1 \
        --quiet \
        -f "$BACKUP_DUMP" \
        >>"$LOG_FILE" 2>&1; then
    echo "FAIL: psql restore retornou erro. Veja $LOG_FILE" >&2
    tail -n 50 "$LOG_FILE" >&2
    exit 1
fi

RESTORE_END_TS=$(date +%s)
RESTORE_DURATION=$((RESTORE_END_TS - START_TS))
echo "   restore concluído em ${RESTORE_DURATION}s"

# ---- validações -------------------------------------------------------------

run_query() {
    psql "$TEST_DB_URL" -At -c "$1"
}

declare -A COUNTS
FAILS=()

CRITICAL_TABLES=(profiles empresas projetos lancamentos)

echo ">> Validando contagens..."
for tbl in "${CRITICAL_TABLES[@]}"; do
    if ! count=$(run_query "SELECT COUNT(*) FROM public.$tbl;" 2>>"$LOG_FILE"); then
        FAILS+=("tabela $tbl não existe ou inacessível")
        continue
    fi
    COUNTS[$tbl]=$count
    if [[ "$count" -le 0 ]]; then
        FAILS+=("$tbl tem $count linhas (esperado > 0)")
    fi
    printf "   %-12s %s linhas\n" "$tbl" "$count"
done

echo ">> Validando RLS habilitado..."
RLS_TABLES=(profiles empresas projetos lancamentos data_deletion_requests audit_logs)
for tbl in "${RLS_TABLES[@]}"; do
    rls=$(run_query "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.$tbl'::regclass;" 2>>"$LOG_FILE" || echo "")
    if [[ "$rls" != "t" ]]; then
        FAILS+=("RLS desabilitado (ou tabela ausente) em $tbl: '$rls'")
    else
        printf "   %-25s RLS ON\n" "$tbl"
    fi
done

echo ">> Validando funções críticas existem..."
CRITICAL_FUNCS=(has_role get_user_empresa_id request_data_deletion)
for fn in "${CRITICAL_FUNCS[@]}"; do
    exists=$(run_query "SELECT 1 FROM pg_proc WHERE proname = '$fn' LIMIT 1;" 2>>"$LOG_FILE" || echo "")
    if [[ "$exists" != "1" ]]; then
        FAILS+=("função $fn não encontrada")
    else
        printf "   %-25s OK\n" "$fn"
    fi
done

# ---- relatório --------------------------------------------------------------

TOTAL_DURATION=$(( $(date +%s) - START_TS ))

echo ""
echo "================ DR drill report ================"
echo "Dump:               $BACKUP_DUMP ($DUMP_BYTES bytes)"
echo "Restore duration:   ${RESTORE_DURATION}s"
echo "Total duration:     ${TOTAL_DURATION}s"
for tbl in "${CRITICAL_TABLES[@]}"; do
    echo "  count($tbl) = ${COUNTS[$tbl]:-N/A}"
done
echo "================================================="

if [[ "${#FAILS[@]}" -gt 0 ]]; then
    echo ""
    echo "FAIL: ${#FAILS[@]} verificação(ões) falhou(aram):"
    for f in "${FAILS[@]}"; do
        echo "  - $f"
    done
    echo ""
    echo "Log completo: $LOG_FILE"
    exit 1
fi

echo ""
echo "OK — todas as verificações passaram."
echo "Log: $LOG_FILE"
exit 0
