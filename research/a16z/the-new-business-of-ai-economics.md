---
title: "The New Business of AI and How It is Different from Traditional Software"
source: "a16z"
type: essay
url: "https://a16z.com/the-new-business-of-ai-and-how-its-different-from-traditional-software/"
author: "Martin Casado & Matt Bornstein (Andreessen Horowitz)"
date_published: "2020-02-16"
date_captured: "2026-06-11"
tags: [unit-economics, pricing, defensibility, moat, ai-native, ai-agents, vertical-saas, b2b-saas, metrics, fundamentals]
relevance_pilar: high
---

## TL;DR
a16z argumenta que negócios de IA têm economia estruturalmente pior que SaaS puro: margens brutas de 50-60% (vs 60-80%+ do SaaS) porque inferência/treino consomem nuvem (25%+ da receita) e há custo recorrente de humanos no loop (10-15% da receita). Pior ainda, os moats são mais rasos que o esperado — IA tende a ser "pass-through" para o produto e os dados subjacentes, com efeitos de rede fracos. Conclusão prática: tratar IA como negócio de serviços com componente de software, não como SaaS clássico.

## Pontos-chave
- Margem bruta de empresas de IA observada em 50-60%, abaixo do benchmark SaaS de 60-80%+.
- Custo de nuvem (treino + inferência) frequentemente 25%+ da receita; treino não acaba no deploy — retreino é custo contínuo porque os dados mudam.
- Human-in-the-loop (rotulagem, manutenção de modelo, intervenção em tempo real) pode consumir 10-15% da receita.
- Trade-off perverso: nuvem e suporte humano estão ligados — reduzir um tende a aumentar o outro; nenhum chega ao custo quase-zero do SaaS.
- Edge cases dominam: 40-50% da funcionalidade pretendida está em lidar com inputs inesperados; cada cliente novo gera dados inéditos, exigindo coleta + fine-tuning dedicado e prazos de deploy imprevisíveis.
- Moats rasos: IA é largamente pass-through, em termos de defensibilidade, para produto e dados subjacentes; efeitos de rede fracos e deseconomias de escala conforme o mercado amadurece.

## Frameworks / números
- Margem bruta IA: 50-60% | SaaS comparável: 60-80%+
- Nuvem (treino+inferência): ~25%+ da receita
- Human-in-the-loop / data labeling / manutenção: 10-15% da receita
- Edge cases: 40-50% da funcionalidade pretendida está no tratamento de inputs inesperados

## Citações
> "gross margins often in the 50-60% range – well below the 60-80%+ benchmark for comparable SaaS businesses."

> "AI companies simply don't have the same economic construction as software businesses. At times, they can even look more like traditional services companies."

> "the moats for AI companies appear to be shallower than many expected. AI may largely be a pass-through... to the underlying product and data."

## Aplicação ao Pilar
- Tratar o custo de inferência do agente de orçamento como COGS variável explícito no modelo de pricing — não assumir margem SaaS de 80%. Precificar por valor (preço de honorário gerado), não por chamada de LLM, para proteger a margem.
- Manter o agente caro (Opus-class) só no passo HITL crítico (revisão/explicação) e usar modelos baratos para extração/parsing — atacar diretamente o trade-off nuvem×humano que o ensaio aponta.
- O moat do Pilar NÃO é o LLM (pass-through): é o dado proprietário do escritório (horas históricas, custos reais, margens por disciplina) + o workflow vertical AEC. Posicionar fundraising/GTM em torno desse dataset, não em "temos IA".
- Modelar edge cases (escopos atípicos, disciplinas raras) como serviço/onboarding pago, não como feature de produto a custo zero — alinhado ao prazo imprevisível de fine-tuning por cliente.

## Relacionadas
[[competitive_vobi]]
[[project_agentic_strategy_2026-06]]
[[project_icp_positioning]]
