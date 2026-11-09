#!/usr/bin/env bash
# Move o status do feedback a partir dos commits (SPEC 145).
#
#   git log A..B --format=%B | scripts/feedback-sync.sh planejado|resolvido
#
# Lê mensagens de commit na entrada, pega cada linha `Feedback: <uuid>` e chama a Edge Function
# feedback-sync. Sem FEEDBACK_SYNC_URL/FEEDBACK_SYNC_TOKEN só avisa e sai com 0 (a automação
# não derruba o CI de quem ainda não configurou os segredos). FEEDBACK_SYNC_DRY_RUN=1 só imprime os ids.
set -euo pipefail

alvo="${1:-}"
case "$alvo" in
  planejado | resolvido) ;;
  *)
    echo "uso: feedback-sync.sh planejado|resolvido" >&2
    exit 2
    ;;
esac

ids=$(grep -ioE '^Feedback:[[:space:]]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  | sed -E 's/^[Ff]eedback:[[:space:]]*//' | tr 'A-F' 'a-f' | sort -u || true)

if [ -z "$ids" ]; then
  echo "Nenhum commit com linha Feedback: neste intervalo."
  exit 0
fi

if [ "${FEEDBACK_SYNC_DRY_RUN:-}" = "1" ]; then
  echo "$ids"
  exit 0
fi

if [ -z "${FEEDBACK_SYNC_URL:-}" ] || [ -z "${FEEDBACK_SYNC_TOKEN:-}" ]; then
  echo "::warning::FEEDBACK_SYNC_URL ou FEEDBACK_SYNC_TOKEN ausente: feedback não sincronizado ($(echo "$ids" | wc -l | tr -d ' ') id(s))."
  exit 0
fi

corpo=$(printf '%s\n' "$ids" | jq -R . | jq -cs --arg alvo "$alvo" '{ids: ., alvo: $alvo}')
curl -fsS -X POST "$FEEDBACK_SYNC_URL" \
  -H "Authorization: Bearer $FEEDBACK_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$corpo"
echo
