# QA — rodada 2026-07-17 a 2026-07-20

Sessão de QA híbrida (7 agentes de análise de código + varredura em runtime no
browser) e as duas rodadas de correção que se seguiram.

## Arquivos
- **REPORT.md** — consolidado: placar, críticos, altos, e toda a verificação em runtime (8 rodadas).
- **CONTEXT.md** — setup, credenciais de teste, limitações do ambiente local.
- **catalogs/** — os 311 casos de teste + 95 achados estáticos, por módulo. Base de regressão do próximo QA.
- **backend/** — relatórios dos agentes de backend: matriz RLS role×tabela, email/convite, delete/edit/integridade.
- **REMAINING.md** — o que foi conscientemente deixado de fora nas correções, com a razão de cada.

## Status das correções (2026-07-20)

Corrigido e mergeado em **staging** em dois PRs:
- **#125** — 5 críticos + núcleo de segurança/dinheiro (RPC bind, RLS features/folha,
  transferência, portal entregas, DEL-02) + UX. 7 migrations. ADR 0006.
- **#126** — altos de AUTH (rate-limit fail-open, onboarding/senha, fetchProfile, gate
  de assinatura), IDOR no download do portal, CSV injection, e a cauda de dinheiro/
  corretude (CHECK valor>0, fuso de fatura, dedup, etc.). 1 migration.

O que **não** foi corrigido (e por quê) está em `REMAINING.md`: decisões de produto,
módulos dormentes, performance, refactors e latentes cosméticos.

> Achados refutados na verificação: ACH-FIN-08 (schema sem `deleted_at`), ACH-PROJ-01/02/03/05
> (código morto não montado), ACH-FOR-01 (soft delete via trigger). Ver REPORT.md.
