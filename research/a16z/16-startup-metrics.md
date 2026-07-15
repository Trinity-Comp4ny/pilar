---
title: "16 Startup Metrics"
source: "a16z"
type: essay
url: "https://a16z.com/16-startup-metrics/"
author: "Jeff Jordan, Anu Hariharan, Frank Chen, Preethi Kasireddy (Andreessen Horowitz)"
date_published: "2015-08-21"
date_captured: "2026-06-11"
tags: [metrics, unit-economics, b2b-saas, vertical-saas, fundraising, gtm, growth, retention, seed, series-a]
relevance_pilar: high
---

## TL;DR
Guia da a16z com 16 métricas que investidores usam para avaliar startups e os erros mais comuns de founders ao apresentá-las. O núcleo: não confundir bookings com revenue, GMV com revenue, MRR com receita não-recorrente; medir LTV como lucro líquido (não receita), separar CAC pago de blended, e distinguir gross churn de net revenue churn. Investidores olham tamanho (GMV/revenue/bookings) → crescimento (CMGR) → retenção/churn → economia (CAC/LTV/burn), nessa ordem.

## Pontos-chave
- **Bookings ≠ Revenue**: bookings é o valor contratual; revenue é reconhecida quando o serviço é entregue (GAAP). Cartas de intenção e acordos verbais não são nem bookings nem revenue.
- **Recorrente ≠ Total**: ARR/MRR devem excluir taxas one-time (setup, hardware, serviços profissionais) e não contar bookings. ARR por cliente crescente = sinal saudável (upsell/cross-sell).
- **LTV é lucro líquido, não receita**: erro comum é estimar LTV como VP da receita ou da margem bruta em vez do lucro líquido ao longo da relação. Abordagem conservadora: medir LTV de 12 e 24 meses em vez de prever lifespan.
- **GMV ≠ Revenue** (marketplaces): GMV é o volume total transacionado; revenue é só o "take" (taxas). 
- **CAC pago ≠ blended**: isolar o custo de aquisição paga; incluir TODOS os custos (referral, créditos, descontos). CAC sobe conforme escala (canais baratos saturam).
- **Gross churn ≠ Net revenue churn**: gross mede a perda real; net mistura upsells e subestima a perda. Cuidado ao vender net retention como se fosse churn baixo.
- **Crescimento**: usar CMGR (taxa composta), não média simples — comparável entre empresas; CMGR < média simples num negócio em crescimento.
- **Burn**: net burn (não gross) mostra quanto tempo o caixa dura.
- **Vanity metrics**: downloads, gráficos cumulativos (sempre sobem) e truques de eixo enganam — o que importa é engajamento por cohort.
- **Billings** = revenue do trimestre + variação de deferred revenue; melhor indicador forward-looking de saúde SaaS que revenue isolada.

## Frameworks / números
- **LTV = margem de contribuição × lifespan médio**; lifespan (meses) = 1 ÷ churn mensal; margem contribuição = receita − custos variáveis.
- **Razão LTV/CAC**: boa medida de payback de CAC e gestão de gasto em marketing.
- **CMGR = (Último mês / Primeiro mês)^(1/nº meses) − 1**
- **CAC blended** = custo total aquisição / total novos clientes (todos canais); **CAC pago** = custo total / clientes via marketing pago.
- **Gross churn** = MRR perdido no mês / MRR início do mês; **Net revenue churn** = (MRR perdido − MRR de upsells) / MRR início do mês.
- **Billings** = revenue do trimestre + (deferred revenue atual − deferred revenue trimestre anterior).
- **Burn mensal** = (caixa início ano − caixa fim ano) / 12; **net burn** = receita (alta probabilidade) − gross burn.
- **Ordem de avaliação**: GMV/revenue/bookings (tamanho) → crescimento → retenção/economia.

## Citações
> "A common mistake is to estimate the LTV as a present value of revenue or even gross margin of the customer instead of calculating it as net profit of the customer over the life of the relationship."
> "GMV does not equal revenue!"
> "Gross churn estimates the actual loss to the business, while net revenue churn understates the losses (as it blends upsells with absolute churn)."

## Aplicação ao Pilar
- **MRR limpo no produto e no pitch**: Pilar tem módulo Financeiro com faturas/parcelas — ao reportar MRR de assinatura (Starter/Pro/Enterprise), excluir setup/onboarding/consultoria. Não inflar com one-time. Vale embutir essa disciplina no próprio dashboard que mostramos a clientes (eles também erram isso).
- **LTV/CAC como features vendáveis**: o ICP do Pilar é "saber se cada projeto dá lucro". A definição correta de LTV (lucro líquido, não receita) é exatamente o que o agente de orçamento de honorários deveria calcular por cliente/projeto — vender margem de contribuição real, não faturamento.
- **Net vs gross dollar retention no nosso fundraising**: ao levantar (seed/series-A), reportar gross churn e net revenue churn separados; com upsell de plano + add-ons de agentes, net retention >100% é tese forte — mas mostrar gross para não parecer que escondemos churn.
- **Tracking de crescimento por CMGR**: padronizar métrica de crescimento de MRR/clientes em CMGR, não média simples, para comparabilidade em deck e board.

## Relacionadas
[[project_icp_positioning]] [[project_agentic_strategy_2026-06]] [[competitive_vobi]]
