---
title: "Marketplaces & Network Effects"
source: "a16z"
type: essay
url: "https://a16z.com/13-metrics-for-marketplace-companies/"
author: "Jeff Jordan, Li Jin, D'Arcy Coolican, Andrew Chen (a16z)"
date_published: "2020-02-21"
date_captured: "2026-06-11"
tags: [marketplace, metrics, growth, unit-economics, retention, defensibility, moat, b2b-saas]
relevance_pilar: low
---

## TL;DR
Compilação canônica da a16z sobre como avaliar marketplaces: liquidez é o ativo número 1 (sem ela o marketplace não tem valor), take rate (% do GMV capturado) sinaliza o valor agregado da plataforma, e network effects se provam em coortes — coortes mais novas devem reter melhor que as antigas conforme a rede adensa. Útil como lente de raciocínio para defensibilidade e retenção, mesmo que o Pilar não seja um marketplace.

## Pontos-chave
- Liquidez é o aspecto mais crítico: a maioria dos marketplaces morre por nunca atingir/manter liquidez. Mede-se por fill/match rate, market depth e time to match.
- Take rate = % do GMV capturado; varia de single digits baixos até ~mid-30s, conforme fragmentação, substitutos e valor operacional agregado. Managed marketplaces capturam take rate maior.
- Network effects se manifestam em coortes: coortes mais novas devem reter MELHOR que as antigas (rede mais densa = produto mais útil). Vale também por geografia (efeitos de rede locais maduram em ritmos diferentes).
- Fragmentação costuma ser desejável; concentração dá poder de barganha a poucos compradores/vendedores.
- Multi-homing / multi-tenanting enfraquece o efeito de rede e a defensibilidade. Switching costs medem a fricção de migrar para o concorrente.
- Métricas de retenção em camadas: user retention, core-action retention, dollar/paid retention, retention por geografia, power user curves.

## Frameworks / números
As 13 métricas de marketplace (a16z):
1. Match rate (utilização) — taxa de match entre oferta/demanda
2. Market depth — suficiência de oferta para a demanda
3. Time to match — tempo até casar oferta/demanda
4. Concentração/Fragmentação — distribuição das transações
5. Take rate — % do GMV retido como receita
6. Unit economics — lucratividade da unidade ao longo do tempo
7. Multi-tenanting — sobreposição com serviços concorrentes
8. Switching/multi-homing costs — fricção de usar concorrentes
9. User retention cohorts — retenção por coorte (novas devem ser melhores)
10. Core action retention cohorts — retenção pela ação principal
11. Dollar & paid user retention — retenção de receita/assinatura
12. Retention by geography — desempenho por mercado (efeitos de rede locais)
13. Power user curves — distribuição de frequência de engajamento

Benchmark: take rate típico de "low single digits" até "mid-30s"%.

## Citações
> "Liquidity ... is the most critical aspect of a marketplace; without it, a marketplace isn't valuable to buyers and sellers."
> "Take rate ... the percentage of the gross merchandise value (GMV) captured by the marketplace."

## Aplicação ao Pilar
- Aplicar a lógica de coortes de retenção mesmo sendo SaaS: coortes de escritórios mais recentes deveriam reter melhor conforme o produto (e o agente de orçamento) amadurece — usar como sinal de PMF, não só MRR.
- Tratar dados acumulados (histórico de horas×custo×margem por projeto) como o equivalente a "liquidez/profundidade": quanto mais projetos orçados, mais preciso o agente — esse é o moat de dados, medir explicitamente.
- Pensar em "take rate" implícito: o quanto do valor gerado (lucro salvo por projeto bem orçado) o Pilar pode capturar via pricing — ancora a discussão de planos Pro/Enterprise no valor agregado, não em features.
- Vigiar multi-homing: se o escritório mantém planilha paralela ao Pilar, o efeito de lock-in é fraco — meta de onboarding deve ser tornar o Pilar a fonte única de verdade do orçamento.

## Relacionadas
[[competitive_vobi]]
[[project_icp_positioning]]
[[project_agentic_strategy_2026-06]]
