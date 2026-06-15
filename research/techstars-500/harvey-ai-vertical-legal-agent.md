---
title: "Harvey AI — agente vertical jurídico em produção (caso)"
source: "Contrary Research"
type: report
url: "https://research.contrary.com/company/harvey"
author: "Contrary Research"
date_published: "2025"
date_captured: "2026-06-12"
tags: [ai-agents, ai-native, vertical-saas, sales, gtm, pricing, defensibility, moat, retention, unit-economics]
relevance_pilar: high
---

## TL;DR
Harvey é o caso de referência de agente vertical de profissão regulada em produção: ~US$75-100M ARR, 28% das Am Law 100 (8 dos 10 maiores escritórios dos EUA usam), NRR implícito >150%. Executa trabalho jurídico real (análise de contrato, pesquisa, drafting, workflows processuais) com humano-no-loop, citação à fonte e controle de alucinação. O moat NÃO é o modelo (usa OpenAI/Anthropic/Google) — é workflow custom co-construído com os escritórios + RAG jurídico + memória persistente. É o análogo mais direto pro Pilar: profissão técnica/regulada, responsabilidade do profissional, dado proprietário do cliente como moat.

## Pontos-chave
- Trabalho que executa: (1) análise de documento — extração de cláusula com 97% de recall em 50+ campos, scoring de risco em 10k docs/projeto; (2) pesquisa jurídica aterrada em fonte primária com citação; (3) drafting de peças/contratos ("Draft Mode"); (4) automação de workflows processuais.
- Trust > capacidade: alucinação em legal AI é 17-33% mesmo em modelos especializados — Harvey vence ao eliminar o risco via auto-revisão do agente + escalonamento ao humano + RAG limitado a base autenticada + link citação→fonte.
- Explicabilidade como feature: cada etapa expõe o raciocínio da IA pra o time validar/refinar — confiança é construída, não assumida.
- Moat = workflow + dado, não modelo: parcerias bespoke (A&O Shearman merger control, Paul Weiss Motion to Dismiss) embutem expertise do escritório; nenhum modelo proprietário próprio.
- GTM top-down: venda enterprise a Am Law 100 + jurídico interno + professional services (PwC). O rollout de 3.500 advogados na Allen & Overy (início 2023) deu a credibilidade institucional que destravou o resto.
- Expansão horizontal a partir de prova vertical: começou com workflow restrito (landlord-tenant, 86% de aprovação dos advogados em teste cego), depois escalou pra M&A complexo.

## Frameworks / números
- ARR ~US$75M (abr/2025) → trajetória US$100M+; NRR implícito >150%.
- 337 clientes jurídicos em 53 países; 28% das Am Law 100; 8 dos 10 maiores escritórios dos EUA.
- ACV estimado ~US$1.000/usuário/mês (per-seat + receita de workflows bespoke). Ancorado na hora do advogado (US$313/h baseline, até US$3k/h).
- Arquitetura: cascata de LLMs fine-tuned + RAG (bases públicas + inputs privados) + orquestração (decomposição de tarefa).

## Citações
> "Each stage of the process exposes the AI's reasoning so teams can trace, validate, and refine outputs as needed."

## Aplicação ao Pilar
- AEC é profissão regulada como o jurídico (CREA/responsabilidade técnica) → a lição "trust > capacidade" é direta: o agente de honorários ganha não por orçar como o sócio, mas por eliminar o risco de erro via HITL + rastreabilidade (mostrar de onde veio cada hora/custo/margem). Construir o "expor o raciocínio" no review cockpit.
- Moat replicável: os workflows custom co-construídos com os primeiros escritórios AEC = o equivalente das parcerias Harvey↔Am Law. Os 10 design partners não são só clientes — são fonte do workflow que vira produto e o moat de dado.
- Pricing ancorado no custo do profissional: Harvey ancora na hora do advogado, não no preço de um SaaS. Pilar ancora o agente no custo da hora do sócio / no honorário em risco quando se subprecifica — não na assinatura da planilha.
- Sequência de expansão: provar 1 workflow restrito com alta taxa de aprovação (orçamento de honorários) antes de abrir pra escopo/aditivo/fluxo — espelha landlord-tenant→M&A.
- Stack pass-through: Harvey, mesmo a US$100M ARR, não tem modelo próprio. Confirma que Pilar não deve perder energia competindo com o modelo base — o valor está no vertical AEC.

## Relacionadas
[[the-new-business-of-ai-economics]]
[[contrary-the-vertical-ai-playbook]]
[[vertical-ai-agents-10x-bigger-than-saas]]
[[service-as-software-paradigm-shift]]
