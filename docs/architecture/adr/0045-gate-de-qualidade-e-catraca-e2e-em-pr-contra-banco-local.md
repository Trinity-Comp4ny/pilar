# ADR 0045: Gate de qualidade é catraca sobre a dívida medida, e E2E roda em PR contra banco local

**Data:** 2026-10-07  
**Status:** Accepted

## Contexto

O CI tinha as ferramentas certas (Vitest, Playwright, pgTAP, deno test, ESLint), mas
boa parte delas não reprovava nada:

- O Playwright só rodava depois do merge, contra staging. Um spec sem login (a11y da
  landing em produção) falhava desde setembro, e como o passo dos specs logados vinha
  depois, ele era **pulado em todo push**. Dois specs logados apodreceram em silêncio
  (botão que mudou de nome; limite de trial da SPEC 098).
- Cobertura era medida, sem piso. Remover teste não mudava a cor do CI.
- As regras de design system (ADR 0008) e o `no-console` eram `warn`: 68 + 14
  ocorrências, e nada impedia a 69ª.
- 38 das 45 Edge Functions não têm nenhum teste; função nova nascia igual.
- Nada media código morto (39 arquivos, 21 dependências sobrando, medido com Knip).

Opções para cada gate:

- **Ligar como erro e limpar tudo antes**: PRs enormes, travam feature por semanas.
- **Deixar informativo (warning, relatório)**: é o estado atual, e ele não segura nada.
- **Catraca**: congelar a dívida medida hoje e reprovar só o que piora. A dívida
  antiga encolhe aos poucos, a nova não entra.

Para o E2E em PR:

- **Contra staging**: PR mutaria o banco compartilhado e precisaria de secret em PR.
- **Contra Supabase local no runner**: o banco nasce das migrations do próprio PR,
  o seed cria o usuário de teste, sem secret e sem dado compartilhado.

## Decisão

1. **Todo gate novo nasce como catraca**, no padrão que o repo já usava em
   `TYPECHECK_DEBT.txt`:
   - Cobertura: `thresholds` por pasta no `vite.config.ts` (piso logo abaixo do
     medido), CI roda `npm run test:coverage`.
   - Design system e `no-console`: regra em `error` + `eslint-suppressions.json`
     (bulk suppressions nativo do ESLint). Corrigiu uma legada: `npm run lint:prune`.
   - Código morto: `knip.json` + `knip-baseline.json` (contagem por categoria),
     checado por `npm run check:dead-code`.
   - Teste de Edge Function: `supabase/functions/TEST_DEBT.txt` +
     `scripts/edge-function-test-debt.test.ts`. Função nova sem teste reprova.
2. **E2E roda em todo PR contra o Supabase local**, job `e2e-local` dentro do
   `CI OK`, com o mesmo comando do dev (`npm run test:e2e:local`). O job pós-deploy
   contra staging continua, como verificação do ambiente real.
3. **Spec que não depende do commit não reprova o commit**: a11y do site de marketing
   em produção virou projeto Playwright separado (`marketing`), informativo, até a
   landing passar no Axe.

## Consequências

**Positivas:**

- Regressão de fluxo do app aparece no PR, antes do merge.
- Nenhuma dívida medida pode crescer sem alguém mexer no baseline num diff visível.
- O dev roda localmente exatamente o que o CI roda.

**Negativas:**

- Cada PR ganha um job a mais de alguns minutos (stack Supabase + build + Playwright), em paralelo
  aos outros jobs.
- Baseline em arquivo exige disciplina: subir número no baseline é sempre uma decisão
  explícita no PR, nunca automática.
- Spec E2E logado depende do seed local (`scripts/seed-local.sql`); mudança de regra
  de negócio que afete a empresa de seed (ex.: limites de trial) pede ajuste no seed.

## Decisões relacionadas

- ADR 0008: design system como fonte única (as regras que agora reprovam)
- ADR 0036: Sentry Crons (o `withCronMonitor` estende aos crons disparados por Edge Function)
- `docs/operations/PLANO_ENGENHARIA_2026-10.md`: plano completo e próximas ondas
