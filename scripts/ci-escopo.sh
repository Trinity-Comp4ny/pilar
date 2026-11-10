#!/usr/bin/env bash
#
# Decide quais grupos de checks um PR precisa, a partir dos arquivos alterados
# (job "Escopo da mudança" do ci.yml). Lê um path por linha no stdin e imprime
# `grupo=true|false` para: code, unit, e2e, db, functions.
#
# Princípio: pular só o que comprovadamente não tem como ser afetado. Arquivo que
# não cai em nenhuma regra conhecida liga TODOS os grupos. Push em staging/main não
# passa por aqui (roda tudo), então o que um PR pular ainda roda no merge.
#
# Grupos e jobs:
#   code       lint, typecheck, build, audit (baratos, rodam em todo PR com código)
#   unit       testes unitários (4 shards) + piso de cobertura
#   e2e        E2E contra Supabase local (o job mais lento)
#   db         migrations + pgTAP + types.ts em sync
#   functions  deno check + deno test das Edge Functions
#
# Dependências entre áreas que as regras respeitam (medidas em 10/11):
# - testes unitários leem migrations e functions (scripts/edge-functions-*.test.ts,
#   src/lib/features.test.ts...), então mexer nelas liga `unit`;
# - o E2E importa src/ (e2e/auth.setup.ts) e serve as functions de verdade;
# - testes leem docs/architecture/EDGE_FUNCTIONS.md e brand/assets/logo.
set -euo pipefail

code=false unit=false e2e=false db=false functions=false

tudo() { code=true unit=true e2e=true db=true functions=true; }

while IFS= read -r f || [ -n "$f" ]; do
  [ -z "$f" ] && continue
  case "$f" in
    # Documentação pura: nenhum check de código (o scan de segredo roda sempre).
    docs/architecture/EDGE_FUNCTIONS.md) code=true unit=true ;;
    docs/* | research/* | .claude/agents/*.md) ;;
    */*.md) tudo ;; # .md dentro de pasta de código: conservador
    *.md) ;;

    # Testes de Edge Function (Deno): não entram no deploy nem no E2E.
    supabase/functions/*.test.ts) code=true unit=true functions=true ;;
    supabase/functions/*) code=true unit=true functions=true e2e=true ;;

    # Banco. types.ts é gerado do schema e importado pelo app inteiro.
    supabase/migrations/* | supabase/tests/* | supabase/seed*) code=true db=true unit=true e2e=true ;;
    src/integrations/supabase/types.ts) code=true db=true unit=true e2e=true ;;

    # Specs do E2E.
    e2e/* | playwright.config.ts) code=true e2e=true ;;

    # Teste unitário do app ou da LP: não vai para o bundle, não muda o que o E2E vê.
    # (O build roda mesmo assim, no grupo code.)
    src/*.test.ts | src/*.test.tsx | apps/marketing/*.test.ts | apps/marketing/*.test.tsx) code=true unit=true ;;
    src/test/*) code=true unit=true ;;

    # LP: tem typecheck/build próprios (code) e testes no Vitest da raiz. O E2E testa o
    # app, não a LP (o projeto "marketing" do Playwright mede o site em produção).
    apps/marketing/*) code=true unit=true ;;

    # Código do app.
    src/* | public/* | index.html) code=true unit=true e2e=true ;;

    # Qualquer outra coisa (scripts/, .github/, package*.json, configs na raiz,
    # brand/, supabase/config.toml...): roda tudo.
    *) tudo ;;
  esac
done

echo "code=$code"
echo "unit=$unit"
echo "e2e=$e2e"
echo "db=$db"
echo "functions=$functions"
