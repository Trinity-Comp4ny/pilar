---
title: "monday.com 2026 — mecânica, pricing real e camada de IA (benchmark p/ Pilar)"
source: "other" # monday.com (fonte primária: pricing page + docs) + análises de terceiros
type: "report"
url: "https://monday.com/pricing"
author: "market-scout-aec"
date_published: "2026-07-24"
date_captured: "2026-07-24"
tags: [pricing, positioning, onboarding, ai-agents]
relevance_pilar: "high"
---

## TL;DR

monday.com não é um concorrente de AEC, é um **construtor de planilha com opinião zero**. O que ele
entrega bem e barato de copiar: **coluna de dependência com modo de deslocamento de datas**,
**biblioteca de templates por vertical** e **crédito de IA como unidade de cobrança**. O que parece
atraente e é armadilha: colunas 100% customizáveis, marketplace e a IA que "cria uma view sob
demanda" (monday vibe), que em 2026 passou a ser um produto pago à parte com custo por prompt.
O US$250/mês citado pelo parceiro **não existe como pacote**; é reconstrutível como seats + add-on
de créditos + apps do vibe.

## Pontos-chave

### Estrutura e pricing (fonte primária, pricing page BR, 24/07/2026)

| Plano      | Preço/seat/mês (anual, BR) | O que destrava                                                                                                                        |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Free       | R$0 (até 2 seats)          | 3 boards, 3 docs, 200+ templates, 8 tipos de coluna, apps iOS/Android                                                                 |
| Basic      | R$50                       | itens ilimitados, viewers ilimitados, 1.000 créditos IA/mês                                                                           |
| Standard   | R$66                       | **timeline/Gantt**, calendário, guests, 250 ações de automação/integração/mês, 2.000 créditos IA, 1.000 chamadas de API/dia           |
| Pro        | R$105                      | boards/docs privados, views avançadas, **time tracking**, colunas avançadas, 25.000 ações/mês, 3.000 créditos IA, 10.000 chamadas/dia |
| Enterprise | sob consulta               | portfólio, resource management, **permissões multinível**, 250.000 ações/mês, SLA 99,9%                                               |

- Em USD, terceiros consolidam **$9 / $12 / $19 por seat/mês no anual** e $12 / $14 / $24 no mensal,
  com **mínimo de 3 seats** (piso real $27 / $36 / $57 por mês). Confiança: média (terceiro, não a
  pricing page oficial em USD).
- **Gantt está no Standard, não no Basic.** Time tracking e board privado só no Pro. Permissão
  granular só no Enterprise. Ou seja: o monday empacota por **capacidade de coordenação**, não por
  volume de dado.

### Dependências (a mecânica que interessa ao parceiro)

- Coluna `Dependency` com 3 modos: **Flexible** (garante não sobreposição), **Strict** (desloca a data
  do dependente exatamente pelo delta) e **No action** (só desenha a relação).
- Mudou a data de um item, a cadeia inteira de dependentes desloca pelo mesmo intervalo.
- Limitação documentada: as colunas Timeline/Date **não auto-preenchem** ao criar a dependência; o
  usuário preenche item a item. É por isso que a comunidade do monday está cheia de gente montando
  automação via Make para o que deveria ser nativo.
- **Não existe lead time de suprimento.** O monday desloca datas, não dispara compra. A dor real do
  parceiro (rebocou hoje, tinta vem da África do Sul em 3 dias, o sistema tem que me obrigar a comprar
  agora) **não é resolvida pelo monday**.

### Camada de IA e o "US$250/mês"

- Crédito de IA a **US$0,01**. Uma AI Block/AI Workflow custa **8 créditos (US$0,08)** por execução,
  cobrada por item dentro de 24h (3 blocks no mesmo item = cobra 8 uma vez, não 24).
- Sidekick (desde 20/07/2026): 1-2 créditos mensagem simples, 4-8 complexa, 8-16 geração de imagem.
- Agentes avançados são caros: chamada de voz do Sales Agent (≤5 min) = **150 créditos**, SMS = 30,
  Lead Agent = 10 por lead.
- Add-on de créditos (anual): 8.000 créditos = **US$960/ano**; 20.000 = **US$2.400/ano**. Mensal custa
  ~25% mais (~US$100/mês no pacote inicial).
- **monday vibe** (o "cria uma página que mostra as vendas da minha loja"): desde **06/05/2026** virou
  dual pricing = **US$10 por app publicado/mês + créditos por prompt de build** (10 a 500 créditos por
  prompt, conforme o modelo). Add-on de 10 apps a partir de **US$100/mês**.
- **Reconstrução do US$250/mês (estimativa, não fonte primária):** 3-5 seats Pro (US$57-95) + add-on de
  créditos mensal (~US$100) + apps do vibe (US$10/app ou US$100 por 10) ≈ **US$200-300/mês**. Não há
  pacote nominal de US$250. O parceiro provavelmente somou a fatura real dele.

### Templates

- Centro com 200+ templates (disponível já no Free). Categoria construção tem **4**: General Contractor
  Solution, Construction Roadmap, Construction Project Tracking, Construction Management.
- Ou seja: o que impressionou o parceiro é **4 boards pré-montados**, não uma vertical de verdade.

## Frameworks / números

- Empacotamento monday = **coordenação por tier**: Gantt (Standard) → privacidade + tempo (Pro) →
  permissão granular + portfólio (Enterprise).
- Unidade de IA = crédito, US$0,01, ação padrão = 8 créditos, saldo mensal por plano, **sem rollover**.
- Piso efetivo: mínimo de 3 seats. R$690/mês do Pilar ≈ 10-13 seats de monday Pro no Brasil.

## Citações

> "Flexible ensures no overlap between dates of dependent items. Strict adjusts an item's dates to
> reflect exact time changes based on the item it depends on." (docs monday, dependências)
> "Starting May 6, 2026, Vibe publishing is included in the AI Credits add-on (1-5 apps depending on
> tier), and every build prompt now costs credits (10-500 depending on model)."

## Aplicação ao Pilar

**Barato de copiar (fazer):**

1. **Modo de dependência na aresta do Fluxo.** O Pilar já tem Fluxos com paralelização e Gantt. Falta
   a aresta ter tipo (flexível/estrito) e **offset em dias**. Isso é campo + regra de recálculo, não
   módulo novo. É a base para o gatilho de suprimento que o parceiro pediu, que o monday **não** tem.
2. **Crédito de IA como medidor visível.** O PRICING v1 do Pilar já prevê créditos. Copiar a mecânica
   inteira do monday: preço unitário publicado, custo por ação publicado, saldo do mês na UI, add-on
   avulso, sem rollover. Isso resolve margem de token e vira argumento de transparência contra o
   "IA ilimitada" que ninguém consegue sustentar.
3. **Templates por vertical no onboarding** (ver nota `templates-por-vertical-onboarding-aec.md`).

**Armadilha (não copiar):**

- **Coluna customizável / board genérico.** É o núcleo do monday e o oposto da tese do Pilar. Produto
  com opinião ("margem por projeto") perde a razão de existir quando o usuário pode montar qualquer
  coisa. Foi exatamente por ser genérico e caro que o parceiro estava procurando alternativa.
- **Marketplace de apps.** Só faz sentido com base instalada; hoje é distração pura.
- **Vibe / IA que gera views sob demanda.** O próprio monday teve que retarifar em maio de 2026 porque
  o custo não fechava. Com 2 usuários ativos, o Pilar pagaria token para gerar telas que ninguém
  mantém, sem moat nenhum. O parceiro achou caro **no monday**, que tem escala; no Pilar seria pior.
- **Cobrança por seat.** O parceiro é construtora com equipe de campo. Seat pune justamente o convite
  de gente que gera o dado (mestre de obra, almoxarife). Ver PRICING.md antes de importar isso.

## Relacionadas

[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[research/aec/templates-por-vertical-onboarding-aec.md]]
[[research/aec/suprimento-estoque-e-frota-concorrentes.md]]
[[docs/strategy/PRICING.md]]
