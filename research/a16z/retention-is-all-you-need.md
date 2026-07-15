---
title: "Retention Is All You Need (a16z) — framework M3/M12 para AI-native"
source: "a16z"
type: "article"
url: "https://a16z.com/ai-retention-benchmarks/"
author: "a16z (Growth team)"
date_published: "2025"
date_captured: "2026-06-12"
tags: [ai-native, retention, metrics, pmf]
relevance_pilar: "high"
---

## TL;DR
a16z analisou centenas de empresas de IA e propõe **rebasear retenção e CAC de M0 para M3** (mês 3). A curva de retenção de produtos de IA cai forte nos primeiros meses ("AI tourists" que testam e somem) e tende a **achatar por volta de M3** — então M0 engana. A métrica-chave é **M12/M3**: quão bem os clientes que sobreviveram à fuga inicial performam no 1º ano completo. Em empresas de IA com >US$1M ARR, M12/M3 fortes já projetam **NDR de longo prazo >100%**, mesmo quando a curva M0 parecia ruim.

> ATENÇÃO — captura parcial: os **valores numéricos exatos do gráfico** ("AI retention benchmarks based on M12") NÃO estão no texto do artigo, só no gráfico (imagem). Esta nota captura o framework e os limiares qualitativos. Os percentuais por coorte/quartil precisam de OCR do gráfico — ver SOURCES.md (captura manual).

## Pontos-chave
- **M0 mente em produtos de IA:** onboarding sem fricção + signup fácil criam uma onda de "AI tourists" que incham o M0 e saem logo. Medir retenção contra M0 superestima o churn real do cliente que fica.
- **M3 é a base "verdadeira":** a curva achata por volta do mês 3 — o que sobra em M3 é a base de clientes real. Rebasear contra M3 dá leitura honesta de PMF e de unit economics.
- **M12/M3 é o preditor antecipado:** mede a performance dos sobreviventes no 1º ano. É leading indicator de NDR de longo prazo — dá pra avaliar PMF e decidir investimento de GTM antes de ter 12 meses de dados maduros.
- **Fases da curva:** Aquisição **M0-M3** → Retenção/expansão **M3-12+**. A expansão (upsell) entra mais tarde no ciclo.
- **Self-serve / month-to-month líderes já batem >100% NDR de longo prazo** com base nesse critério — atrativo até pela régua histórica de SaaS.

## Frameworks / números
- **Rebase M0 → M3:** medir retenção e CAC a partir do mês 3, não do mês 0.
- **Métrica-chave: M12/M3** (retenção de receita do mês 12 dividida pela do mês 3). M12/M3 forte → projeta **NDR de longo prazo >100%**.
- **Fases:** Aquisição M0-M3 · Retenção+Expansão M3-12+ · curva achata ~M3.
- _Valores exatos por coorte/quartil: no gráfico, não transcritos (pendente OCR)._

## Citações
> Industry-leading self-serve or month-to-month billing AI companies today already perform strongly on this basis, a leading indicator to >100% long term net dollar retention.

## Aplicação ao Pilar
- **Não julgar PMF/churn do agente pela coorte M0:** se o Pilar abrir trial/self-serve do agente de orçamento, haverá "turistas" que testam e somem. Medir retenção a partir de **M3** (quem ainda gera orçamento no mês 3) — esse é o cliente real. Evita pânico precoce e evita comemorar adoção falsa.
- **Instrumentar M12/M3 por coorte de escritório desde o MVP:** complementa o insight #24 (NRR/GRR vertical) com um leading indicator que funciona com N pequeno e poucos meses de dados — exatamente a situação do Pilar early. Operacionaliza "medir PMF sem N grande" (backlog #3).
- **O preço alto que seleciona contra turista (insight #25) e o rebase M3 são a mesma defesa:** ChartMogul mostrou que preço >US$250/mês mata o churn de turista; a16z mostra que medir a partir de M3 revela quem ficou. Juntos: precificar alto + medir M3 = leitura limpa de quem incorpora o agente no workflow.
- **Definir o aha (1º orçamento aprovado sem edição, insight #23) como o que precisa acontecer ANTES de M3:** se a ativação real ocorre nas primeiras semanas, o cliente chega a M3 retido. Amarrar onboarding white-glove (gerar o 1º orçamento junto) à sobrevivência até M3.

## Relacionadas
[[chartmogul-ai-churn-wave-retention]] [[generative-ai-act-two]] [[saas-metrics-that-matter]] [[lenny-activation-rate-benchmarks]] [[superhuman-engine-to-find-pmf]]
