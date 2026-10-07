# Regressão visual

`telas.visual.spec.ts` compara 6 telas com uma imagem de referência
(`telas.visual.spec.ts-snapshots/*-visual-linux.png`). Roda só no CI, no job
"E2E (Playwright, Supabase local)", antes dos specs que criam dados.

## Falhou no PR

Baixe o artifact `playwright-report-local-*` do run: em `test-results/` estão a
imagem esperada, a atual e o diff de cada tela. Se a diferença é bug, corrija. Se
é mudança de propósito, atualize a referência (abaixo).

## Atualizar a referência

A referência precisa ser gerada em Linux (mesmo runner do CI); a do macOS difere
em fonte e antialiasing. Por isso não se atualiza na máquina local:

1. No PR, ligue `E2E_VISUAL_ATUALIZAR: "1"` no job `e2e-local` do `ci.yml` e faça push.
2. Baixe o artifact `screenshots-visual-*` do run e copie os PNGs para
   `e2e/visual/telas.visual.spec.ts-snapshots/`.
3. Desligue a variável e faça push de novo. O run seguinte compara contra a
   referência nova e precisa ficar verde.

## O que é mascarado

Texto que muda sozinho com o calendário (datas, "há N dias", dinheiro, mês por
extenso), corpo de tabela e toasts. A máscara mantém a posição do elemento, então
layout que desloca continua reprovando.
