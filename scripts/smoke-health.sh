#!/usr/bin/env bash
# Smoke test do /health depois de um deploy de edge functions.
#
# Por que existe: o passo anterior era `sleep 20` + um `curl -sf` único. Quando
# as 44 functions ainda estavam propagando o redeploy, o curl levava um erro
# HTTP e o job ficava vermelho com um deploy que na verdade deu certo (CD de
# 20/08, run 32413594474: migrations aplicadas, functions deployadas, e o
# health respondendo 200 poucos segundos depois). Pior: `curl -s` engolia o
# status, então o log não dizia o que tinha acontecido.
#
# Um X vermelho recorrente por motivo transitório treina o time a ignorar o CD,
# que é o oposto do que um smoke test serve.
#
# Uso: PROJECT_REF=... ANON_KEY=... [EXPECTED_SHA=...] scripts/smoke-health.sh
set -uo pipefail

: "${PROJECT_REF:?PROJECT_REF é obrigatório}"

if [ -z "${ANON_KEY:-}" ]; then
  echo "::notice::ANON_KEY não configurado, smoke test pulado (o deploy em si já rodou)."
  exit 0
fi

URL="https://${PROJECT_REF}.supabase.co/functions/v1/health"
TENTATIVAS=${TENTATIVAS:-6}
ESPERA=${ESPERA:-10}
BODY=/tmp/health.json

for i in $(seq 1 "$TENTATIVAS"); do
  # Cold start da function depois do deploy costuma passar de 10s: timeout largo.
  STATUS=$(curl -s -o "$BODY" -w '%{http_code}' --max-time 45 "$URL" \
    -H "Authorization: Bearer ${ANON_KEY}" || echo "000")

  if [ "$STATUS" = "200" ] && grep -q '"status"' "$BODY"; then
    echo "health OK na tentativa $i (HTTP $STATUS)"
    cat "$BODY"
    echo

    # O campo version vem do secret RELEASE_SHA, que só entra no próximo cold
    # start de cada function. Ficar atrás do commit recém-deployado é normal por
    # alguns minutos, então divergência é aviso, nunca falha.
    if [ -n "${EXPECTED_SHA:-}" ]; then
      VERSION=$(sed -n 's/.*"version":"\([^"]*\)".*/\1/p' "$BODY")
      if [ -n "$VERSION" ] && [ "$VERSION" != "$EXPECTED_SHA" ]; then
        echo "::warning::health respondeu com version=$VERSION, esperado $EXPECTED_SHA (secret propaga no próximo cold start)."
      fi
    fi
    exit 0
  fi

  echo "tentativa $i/$TENTATIVAS: HTTP ${STATUS:-sem resposta}"
  [ -s "$BODY" ] && head -c 400 "$BODY" && echo
  [ "$i" -lt "$TENTATIVAS" ] && sleep "$ESPERA"
done

echo "::error::/health não respondeu 200 depois de $TENTATIVAS tentativas (último status: ${STATUS:-sem resposta}). Corpo da última resposta acima."
exit 1
