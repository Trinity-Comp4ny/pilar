---
title: "How to Price and Package Your Gen AI Feature"
source: "a16z"
type: article
url: "https://a16z.com/pricing-packaging-ai-b2b-prosumer/"
author: "Andreessen Horowitz (a16z Growth)"
date_published: "2024-03"
date_captured: "2026-06-10"
tags: [pricing, gtm, b2b-saas, vertical-saas, ai-native, ai-agents, unit-economics, positioning, growth]
relevance_pilar: high
---

## TL;DR
Toda feature de Gen AI cai em 3 baldes de packaging — core, upgrade tier ou add-on — e a escolha depende de quanto valor entrega, pra quem, e quanto custa servir (COGS de inferência). Assinatura por seat é o default confortável, mas desalinha incentivos (power users sangram margem pagando o mesmo flat). A direção do mercado é híbrido (assinatura + consumo/créditos) e, mais raro, outcome-based. Regra de ouro: precifique em nível ao menos economicamente saudável no curto prazo e conte com a queda do custo de inferência pra expandir margem depois. Numa revisita (nov/2025), o que era add-on premium virou table stakes — Notion e Salesforce migraram de cobrança separada de IA pra embutir no core.

## Pontos-chave
- 3 perguntas iniciais: (1) quanto valor a feature entrega e pra quem? (2) quanto custa servir? (3) quão central a IA é ao produto?
- **Core**: inclua quando todos querem, dados early mostram ganho de adoção/conversão e é missão-crítica. Pode não monetizar direto por causa de TAM/conversão downstream; vence a fase de "land grab".
- **Upgrade tier**: IA como "nice-to-have" que serve de alavanca de upsell pra maioria sem mudar radicalmente o uso (ex.: Mailchimp com copy/segmentação por IA).
- **Add-on**: quando entrega muito valor a um conjunto pequeno disposto a pagar premium. Permite gerir margem direto, expandir TAM segmentando por willingness-to-pay e usar como canal de beta com usuários engajados.
- Assinatura por seat é o default porque "nenhum cliente quer estimar quanto de genAI vai usar" — mas desalinha: power users pagam igual e corroem margem.
- Híbrido (assinatura + consumo/créditos) corrige o desalinhamento: Box (drawdown de créditos), Adobe Creative Cloud (seats flat + créditos incrementais).
- Outcome-based ainda é experimental (ex. Intercom Fin); melhor pra produtos software-to-human (workflow/RH); difícil porque founders ainda quantificando o valor da IA.
- Feature tiering DENTRO da IA: básico no core/tiers baixos, modelos melhores e limites de uso maiores gated em premium.
- Cuidado com "AI tourists": clientes que entram por mandato corporativo (B2B) ou empolgação (prosumer) e são difíceis de reter mesmo pagando no início.
- Revisita (nov/2025): quem migrou add-on→core geralmente migrou assinatura→híbrido pra cobrir inferência; add-ons premium viraram table stakes.

## Frameworks / números
- **Matriz de packaging**: valor entregue (alto/baixo) × amplitude da base que quer (todos / maioria / poucos) → core / upgrade tier / add-on.
- **Modelos de pricing por ordem de maturidade**: subscription (seat) → híbrido (sub + consumo/créditos) → outcome-based.
- **Teste de uso early/beta**: expande TAM (servia 10, agora 100?) / aumenta conversão free→paid ou upgrade de tier / power users concentram uso e impactam COGS desproporcionalmente?
- Estudo cobriu 31 empresas com novas ofertas de Gen AI; sem números de preço publicados (exemplos conceituais: Mailchimp, Intercom, Box, Adobe, Notion, Salesforce).
- Janela da revisita: ~20 meses (mar/2024 → nov/2025).

## Citações
> "selling seats for your gen AI feature can actually put you in the position of hoping your customers don't use your products."
> "Price at a level that's at least somewhat economical for your business in the short term... and drive future margin expansion."

## Aplicação ao Pilar
- O agente de orçamento de honorários é caso clássico de **add-on/híbrido**: entrega valor concentrado e tem COGS de token real por execução. Casa com a tese de pricing híbrido (assinatura + por tarefa) — cobrar a plataforma no seat e o agente por execução/crédito evita o desalinhamento "torcer pra cliente não usar".
- Modelar agora a unit economics por execução do agente (tokens × custo/1k + margem) e setar o preço por tarefa "ao menos economicamente saudável", contando com queda de custo de inferência pra expandir margem — não subsidiar no escuro.
- Decidir explicitamente o papel da IA no Pilar: hoje IA Hub está dormente; se o agente de orçamento for o diferencial de venda, ele é add-on premium, NÃO core embutido — segmenta willingness-to-pay e protege margem enquanto o produto base (gestão AEC) segue no seat.
- Usar créditos como unidade de cobrança do agente (drawdown estilo Box) facilita comunicar valor sem o cliente "estimar quanto de IA vai usar" e dá alavanca de upsell por volume de orçamentos.

## Relacionadas
[[]]
