#!/usr/bin/env bash
#
# Dependências de sistema do browser do Playwright, sem pagar `apt-get update` a
# cada run. Uso no CI (jobs de E2E do ci.yml), depois de restaurar o cache em
# $PW_APT_CACHE.
#
# Por que existe: `playwright install-deps` SEMPRE roda `apt-get update` + `install`,
# mesmo quando não falta nada. No CI isso custava 1m26 a 2m09 por job e era o passo
# mais lento do caminho crítico do PR (run 42747924078, 10/11).
#
# Como funciona:
# 1. `install-deps --dry-run` simula (`apt-get install -s`, sem root) e lista só o
#    que falta, já com as dependências transitivas.
# 2. Nada faltando: sai.
# 3. Há .deb em cache (mesma imagem do runner, mesmo Playwright): `dpkg -i` direto.
# 4. Sem cache, ou o cache não resolveu: baixa os que faltam para o diretório do
#    cache, instala com `dpkg -i` e avisa (output baixou=true) para a action salvar.
#    Se até isso falhar, cai no `install-deps` oficial: nunca fica pior que antes.
set -euo pipefail

CACHE_DIR="${PW_APT_CACHE:-$HOME/.cache/pw-apt}"
mkdir -p "$CACHE_DIR"

faltando() {
  # Saída do dry-run: "Missing system dependencies (N):" e depois "  pacote" por linha.
  # Exit code 1 quando falta algo, por isso o `|| true`.
  npx playwright install-deps --dry-run chromium 2>&1 | sed -n 's/^  \([^ ]\+\)$/\1/p' || true
}

oficial() {
  echo "::warning::Caminho rápido falhou; usando 'playwright install-deps' (apt-get update completo)."
  npx playwright install-deps chromium
}

MISSING="$(faltando)"
if [ -z "$MISSING" ]; then
  echo "Dependências do browser já instaladas."
  exit 0
fi
echo "Faltando ($(printf '%s\n' "$MISSING" | wc -l | tr -d ' ')): $(printf '%s ' $MISSING)"

if compgen -G "$CACHE_DIR/*.deb" >/dev/null; then
  echo "Instalando do cache ($(ls "$CACHE_DIR"/*.deb | wc -l | tr -d ' ') .deb)..."
  if sudo dpkg -i "$CACHE_DIR"/*.deb >/dev/null 2>"$CACHE_DIR/dpkg.err"; then
    if [ -z "$(faltando)" ]; then
      echo "Dependências instaladas do cache, sem apt-get update."
      exit 0
    fi
  fi
  echo "Cache incompleto ou inválido para esta imagem; baixando de novo."
  sudo rm -f "$CACHE_DIR"/*.deb
fi

# shellcheck disable=SC2086 # um pacote por palavra
if sudo apt-get update -qq \
  && sudo mkdir -p "$CACHE_DIR/partial" \
  && sudo apt-get install -y -qq --download-only --no-install-recommends \
       -o Dir::Cache::archives="$CACHE_DIR" $MISSING \
  && sudo dpkg -i "$CACHE_DIR"/*.deb >/dev/null \
  && [ -z "$(faltando)" ]; then
  # O actions/cache roda como o usuário do runner: os .deb precisam ser legíveis.
  sudo rm -rf "$CACHE_DIR/partial" "$CACHE_DIR/lock"
  sudo chown -R "$(id -u):$(id -g)" "$CACHE_DIR"
  # A action salva o cache só quando este passo baixou pacote (ver setup-playwright).
  echo "baixou=true" >>"${GITHUB_OUTPUT:-/dev/null}"
  echo "Dependências instaladas; .deb guardados para o próximo run."
  exit 0
fi

oficial
