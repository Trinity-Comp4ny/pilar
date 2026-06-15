---
title: "AI Is Upending SaaS Pricing (podcast)"
source: "a16z"
type: podcast
url: "https://a16z.com/podcast/ai-is-upending-saas-pricing/"
author: "Martin Casado (a16z) e Scott Woody (Metronome)"
date_published: "2025-07-18"
date_captured: "2026-06-11"
tags: [pricing, gtm, b2b-saas, vertical-saas, ai-native, ai-agents, unit-economics, sales]
relevance_pilar: high
---

## TL;DR
Na era cloud o valor escalava com número de usuários (per-seat, ex. Salesforce); na era AI o valor escala com o *trabalho* que o software executa por você (resolver tickets, escrever código). A métrica de valor migra de "usuários" para "output", então per-seat perde sentido e usage/outcome-based ganham — mas usage tem limites (custos variáveis imprevisíveis de inferência), e o desenho prático tende a modelos híbridos. Não existe bala de prata: cada empresa precisa achar seu "pricing-market fit" por experimentação.

## Pontos-chave
- Per-seat fica obsoleto quando a AI faz o trabalho que antes exigia um humano por assento: se a AI resolve o ticket, cobrar por "agente de suporte" não faz sentido — a métrica natural vira o resultado (ticket resolvido).
- Software está virando "labor" (mão de obra): suporte, vendas, marketing, finanças automatizados — service business virando software escalável.
- Usage-based ganha tração porque alinha preço ao trabalho executado, mas tem fricção: custos marginais dependem de foundation models e variam por usuário e por complexidade da tarefa (imprevisibilidade de COGS).
- Outcome-based é o destino conceitual ("cobrar pelo resultado bem-sucedido"), mas é difícil de medir/atribuir e de garantir margem quando o custo por tarefa varia.
- Híbridos são o padrão emergente: seat + usage para premium (Cursor), ou per-conversation + per-resolution (Decagon).
- GTM e Customer Success precisam ser realinhados à nova métrica de valor (output), não a seats.

## Frameworks / números
Taxonomia de modelos (do material a16z relacionado):
- AI-native: Decagon = per-conversation (usage) + per-resolution (outcome) híbrido; Cursor = seat + usage para modelos premium; ElevenLabs = usage-based.
- Tradicionais: Zendesk ~US$115/mês por assento de agente; Notion/Canva per-seat ou bundled.
- Três forças: (1) software virando labor; (2) obsolescência do per-seat; (3) custo variável imprevisível atrelado a foundation models.
- Custo de inferência caindo forte, mas reasoning avançado ainda caro → reforça usage-based para proteger margem.
- Conceito-âncora: buscar "pricing-market fit" por experimentação; "não há solução one-size-fits-all".

## Citações
> "value shifts to the work the software performs on your behalf"
> "the old value metric of 'users' is being replaced by 'output'"

## Aplicação ao Pilar
- O agente de orçamento de honorários (1º agente) deve precificar por output/uso, não por seat: ex. por orçamento gerado/aprovado ou pacote de orçamentos/mês — não por usuário do escritório. Isso casa exatamente com a tese "cobre pelo trabalho executado".
- Modelo híbrido recomendado: manter assinatura base do SaaS vertical (Starter/Pro/Enterprise já existentes) + componente de usage/outcome no agente (ex. créditos de orçamento ou taxa por proposta gerada com HITL aprovada).
- Proteger margem: como cada orçamento consome inferência de custo variável, instrumentar custo por execução (ligar ao trabalho já planejado de `ai_usage_logs`) antes de fixar preço do agente — evitar preço plano que sangra COGS em casos complexos.
- Posicionamento de vendas: vender "resultado" (orçamento pronto, com horas×custo×margem→preço) e não "acesso ao software"; alinhar narrativa de GTM à métrica de output, reforçando a tagline de lucro por projeto.

## Relacionadas
[[competitive_vobi]]
[[project_agentic_strategy_2026-06]]
[[project_icp_positioning]]
