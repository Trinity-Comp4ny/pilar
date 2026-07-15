---
title: "Métricas de SaaS / startup — síntese"
source: "theme"
type: "theme"
tags: [metrics, unit-economics, retention, growth, pmf]
relevance_pilar: high
date_captured: "2026-06-11"
---

## Tese do tema
Uma **métrica norte** (quase sempre receita) batida semanalmente é a bússola. Quais métricas
importam muda com o estágio de PMF: no early (até ~US$1-2M ARR) CAC/LTV/magic number quase não
importam — vale crescimento + burn baixo + amor do cliente; eficiência (NRR, CAC payback, Rule of 40)
vira relevante depois. Cuidado com armadilhas de definição: bookings≠revenue, GMV≠revenue,
LTV = lucro líquido (não receita), gross churn ≠ net revenue churn.

## Notas-fonte
- [[how-to-set-kpis-and-goals]] — 1 métrica norte; 5-10% w/w; counter-metrics
- [[startup-equals-growth]] — taxa de crescimento como bússola
- [[16-startup-metrics]] — a16z: definições corretas e erros comuns
- [[saas-metrics-that-matter]] — First Round Levels of PMF: métricas por nível (L1→L4)
- [[bessemer-10-laws-of-cloud]] — CLTV/CAC≥3x, NRR>100%, Rule of 40, CAC payback 6-36m
- [[saastr-saas-metrics-lemkin]] — early stage ignora CAC/LTV; burn baixo "resume" muito
- [[bessemer-scaling-to-100-million]] — tabela por banda de ARR: crescimento, NRR, margem, FCF, CAC payback
- [[benchmarkit-2025-saas-performance-metrics]] — NRR 101% / GRR 88% medianos 2025; retenção sobe com ACV; expansão 40% do novo ARR
- [[saas-capital-vertical-retention-benchmarks]] — vertical +7pp NRR / −5pp churn; back-office <4% churn
- [[chartmogul-ai-churn-wave-retention]] — AI-native GRR 40%/NRR 48%; preço define retenção
- [[capital-efficiency-magic-number-burn-multiple-rule40]] — magic >0,75; burn <1,5x; Rule of 40 só pós-Série A

## Benchmarks canônicos
- CLTV/CAC ≥ 3x · NRR > 100% (bom; >120% excelente) · gross retention > 90% (enterprise)
- CAC payback 6-18m (SMB) / 24-36m (enterprise) · Rule of 40 (crescimento% + margem FCF% ≥ 40)
- Crescimento semanal saudável 5-10% w/w no início.

### Por banda de ARR (Bessemer, mediano)
- Crescimento YoY: US$1-10M = 165% · US$10-25M = 87% · US$25-50M = 77% · US$50M+ = ~60%.
- NRR: US$1-10M = 125% · US$10M+ = 115-120%. "Só o quartil inferior tem NRR < 100%."
- Margem bruta cloud puro 65-70% (top 75-85%); FCF −167% em US$1-10M (queimar cedo é normal).

### Mercado 2025 (Benchmarkit, mediano — referência de "mediocre", não meta)
- NRR 101% · GRR 88% · crescimento 26% · CAC US$2,00 de S&M por US$1 de ARR novo · expansão 40% do novo ARR.
- Retenção SOBE conforme o ACV sobe — ticket maior é mais defensável.

### Vertical SaaS (SaaS Capital/Tidemark)
- Vertical: NRR 112%, +7pp e −5pp churn vs horizontal · back-office <4% churn anual · fintech-vertical GRR 96%, NRR 120%+.
- Bootstrapped capital-eficiente (US$3-20M, perfil Pilar): crescimento 15% / NRR 103% / GRR 91% medianos.

### AI-native (ChartMogul / a16z) — régua DIFERENTE, não copiar SaaS puro
- AI-native mediano: GRR 40% / NRR 48% (poluído por turista/freemium). Margem bruta ~52% (COGS de inferência).
- **Preço define retenção:** >US$250/mo = GRR 70%/NRR 85% (≈ B2B bom); <US$50/mo = GRR 23%/NRR 32%.
- Medir retenção filtrando turista: M12/M3 (a16z) — coorte que passou de ~M3.

### Eficiência de capital (quando importa)
- Magic number >0,75 (gate p/ escalar vendas) · burn multiple <1,5x · CAC payback <18m (mid-market).
- Rule of 40 e burn multiple como META só pós-Série A (~US$5M+ ARR); antes = bússola interna.

## Aplicação ao Pilar
- Norte = MRR de escritórios ativos (não "orçamentos gerados" — uso grátis distorce).
- Pilar está em L1-L2: medir retenção/NRR por coorte + amor do cliente; adiar CAC/magic number.
- Instrumentar custo de inferência por orçamento (`ai_usage_logs`) como COGS — ver [[the-new-business-of-ai-economics]].
- "System of results" (Bessemer Lei 8): medir orçamentos aceitos e horas economizadas, não tempo-no-app.
