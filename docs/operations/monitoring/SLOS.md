# SLOs do Pilar

Objetivos de serviço medidos, não promessas comerciais (não há SLA contratual). Cada SLO
diz de onde vem a medida. Decisão: [ADR 0047](../../architecture/adr/0047-saude-por-componente-e-status-page-fora-da-infra.md),
[SPEC 105](../../specs/105-golden-signals-slos-e-status-page.md).

Janela de avaliação: 30 dias corridos. Revisão: primeira segunda-feira do mês, olhando o
Better Stack (disponibilidade) e o Sentry (latência e erros).

## Metas

| Sinal                       | Meta (30 dias)                                     | Fonte da medida                                                                  |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Disponibilidade do app      | 99,5%                                              | Better Stack, monitor `App` (`app.pilarsoft.com.br/login`)                       |
| API e banco                 | 99,5%                                              | Better Stack, `health?componente=banco`                                          |
| Login                       | 99,5% dos checks                                   | Better Stack, `health?componente=autenticacao` + login real do monitor sintético |
| Pagamentos                  | 100% dos webhooks de checkout processados sem erro | `health?componente=pagamentos` (`pilar_checkout_webhook_logs`)                   |
| E-mails                     | 99% enviados                                       | `health?componente=emails` (`email_envios`)                                      |
| IA                          | 98% das execuções sem falha                        | `health?componente=ia` (`agent_runs`, `jobs`)                                    |
| Crons                       | 100% das execuções do dia, nenhum dia sem execução | `health?componente=crons` (`cron.job_run_details`)                               |
| Latência das Edge Functions | p95 < 1,5 s (fora das `ai-*`)                      | Sentry, spans `edge.function`                                                    |
| Carregamento de página      | p95 < 3 s                                          | Sentry, spans `pageload`                                                         |

Por que 99,5% e não 99,9%: o Supabase está no plano free, sem SLA nem PITR, e a operação é
de uma pessoa. 99,5% são 3,6 h de indisponibilidade por mês; 99,9% seriam 43 min, meta que
a infraestrutura de hoje não garante. Subir junto com o plano Pro.

## Onde estamos (medido em 2026-10-09)

| Sinal                      | Hoje                             | Leitura                                                                                                   |
| -------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Carregamento de página p95 | ~5,6 s (7 dias); `/inicio` 8,4 s | Fora da meta. p50 ~1 s: a cauda lenta é do `/inicio`.                                                     |
| Edge Functions p95         | ~4,8 s com IA                    | IA domina (`ai-rdo-voz` 6 a 7 s). Fora dela, ~1,6 s, exceto `ultra-admin-empresas` (4,8 s em 3 amostras). |
| Pagamentos, e-mails, crons | 0 falhas em 30 dias              | Dentro.                                                                                                   |
| IA                         | 7 execuções, 0 falhas em 30 dias | Dentro.                                                                                                   |

Os alertas de latência estão em "pior que hoje" (página > 10 s, Edge Function > 3 s) para
não disparar todo dia; descem para a meta quando o `/inicio` for otimizado.

## Alertas

| O quê                                       | Onde                                         | Chega por                           |
| ------------------------------------------- | -------------------------------------------- | ----------------------------------- |
| Componente fora (monitor por componente)    | Better Stack                                 | E-mail e app do Better Stack        |
| Erros em produção > 10 em 10 min            | Sentry, monitor "Erros em produção acima..." | E-mail (alerta "Saúde da produção") |
| Edge Function p95 > 3 s por 15 min (sem IA) | Sentry, monitor de latência                  | E-mail (mesmo alerta)               |
| Página p95 > 10 s por 30 min                | Sentry, monitor de carregamento              | E-mail (mesmo alerta)               |
| Issue nova de prioridade alta               | Sentry, alerta já existente                  | E-mail                              |
| Monitor sintético (login real) falhou       | GitHub Actions, issue "Cron falhando: ..."   | E-mail do GitHub                    |

## Orçamento de erro

Se um SLO estourar no mês, o mês seguinte começa pela causa (feature nova espera). Se
estourar dois meses seguidos, a meta ou a arquitetura daquele componente vira ADR.
