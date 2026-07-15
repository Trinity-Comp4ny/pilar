---
title: "AI Is Driving a Shift Towards Outcome-Based Pricing"
source: "a16z"
type: article
url: "https://a16z.com/newsletter/december-2024-enterprise-newsletter-ai-is-driving-a-shift-towards-outcome-based-pricing/"
author: "a16z Enterprise"
date_published: "2024-12"
date_captured: "2026-06-10"
tags: [pricing, ai-agents, b2b-saas, unit-economics, metrics]
relevance_pilar: high
---

## TL;DR
IA quebra o pricing por assento: se o software faz o trabalho que antes exigia gente, o cliente
precisa de menos licenças — cobrar por seat *penaliza* a adoção. O movimento é pra pricing atrelado
ao **resultado entregue**. Mas outcome puro é difícil (COGS variável de tokens, medir "resolução",
comprador prefere custo fixo); o caminho prático é **híbrido**.

## Pontos-chave
- **Por que seat falha:** Zendesk cobra ~US$115/agente/mês; se a IA resolve 60% dos tickets, o cliente
  precisa de menos seats → modelo penaliza automação em vez de capturar valor.
- **Espectro de pricing:** per-seat → usage/créditos-por-tarefa → outcome-based → híbrido.
  AI-native (Decagon, ElevenLabs) adotam modelos novos; incumbentes (Zendesk, Notion) seguem per-seat.
- **3 desafios:** (1) COGS variável imprevisível (cada token a Anthropic/OpenAI é custo direto);
  (2) medir/atribuir "outcome" é mais difícil que contar seats — exige telemetria e confiança;
  (3) comprador enterprise prefere custo fixo.

## Frameworks / números
**Recomendações pra vertical AI early-stage:**
1. **Começar híbrido** — baseline de uso + upside por outcome (reduz risco do comprador, captura ganho de eficiência).
2. **Medir obsessivamente** — telemetria de atribuição de outcome; sem ROI provável, ninguém paga prêmio.
3. **Segmentar por comprador** — seat onde fricção de adoção é alta; outcome onde o resultado é fácil de quantificar e valioso.
4. **Stress-test de unit economics** — modelar custo de token por tier; COGS variável não pode comer a margem em escala.
5. **Mirar "pricing-market fit"** — testar vários modelos; o pricing mais elegante nem sempre é o mais lucrativo.

## Citações
> "When AI can handle a sizable proportion of customer support, the natural pricing metric becomes successful outcomes."

## Aplicação ao Pilar
- **Confirma o plano de pricing da memory:** assinatura base R$200-500 + **por tarefa** quando a taxa
  de aprovação sem edição for alta. Isso é exatamente o "começar híbrido" da a16z.
- **Telemetria de outcome = a métrica-chave a instrumentar:** "% de orçamentos aprovados sem edição".
  Já há proto-infra (`ai_insights` com status). Sem isso medido, não dá pra migrar pra por-tarefa.
- **COGS:** Gemini 2.0 Flash via fetch cru é barato → margem boa mesmo em uso; modelar custo por orçamento gerado.
- **Sequência:** lançar com assinatura (custo fixo agrada o escritório AEC conservador) e introduzir
  por-tarefa só depois que a telemetria provar alta aprovação. Não vender outcome antes de medir.

## Relacionadas
[[vertical-ai-agents-10x-bigger-than-saas]] [[the-vertical-ai-playbook]]
