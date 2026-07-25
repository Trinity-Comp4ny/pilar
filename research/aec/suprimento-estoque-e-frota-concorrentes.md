---
title: "Estoque de canteiro, lead time de suprimento e frota de equipamento — quem resolve e por quanto"
source: "other" # sites dos fornecedores + agregadores de review/pricing
type: "report"
url: "múltiplas — ver Citações"
author: "market-scout-aec"
date_published: "2026-07-24"
date_captured: "2026-07-24"
tags: [vertical-saas, positioning, pricing, moat]
relevance_pilar: "medium"
---

## TL;DR

As três dores que o parceiro descreveu (**estoque de material no canteiro**, **dependência de etapa com
lead time de compra** e **gestão de frota de aluguel**) existem no mercado, mas **em três categorias
separadas de software**, nenhuma delas junta as três, e as que chegam perto ou são enterprise
americanas (Kojo, PLOT) ou são ERP de locadora, que é outro negócio. O único produto barato que cobre
estoque + cronograma + diário no mesmo lugar é o **Contractor Foreman a US$49/mês por empresa com
usuários ilimitados**, e ele é o benchmark de preço que qualquer módulo desses no Pilar vai enfrentar.

## Pontos-chave

### 1. Estoque de material em canteiro

**Brasil (todos com preço sob consulta, confiança baixa em valor):**

- **Almob** — almoxarifado de construção civil com reconhecimento facial, controle de EPI e ferramentas, integração com ERP.
- **VIGHA** — entradas e saídas de material e equipamento do canteiro.
- **Mais Controle** — ERP de construção com orçamento, cronograma, compras e financeiro.
- **SoftExpert Storeroom** — módulo de almoxarifado genérico, níveis de estoque e custo de transporte.
- **PopData** — almoxarifado e patrimônio para construtoras.

**Internacional:**

- **Kojo** (ex-Agora) — plataforma de procurement de material para specialty contractors e GCs
  self-perform: requisição, PO, recebimento, estoque, fornecedor, aprovação, trilha de auditoria.
  Integra Procore, Autodesk Build, QuickBooks, Sage 300/Spectrum. **Preço sob consulta** (custom quote).
- **Contractor Foreman** — **a partir de US$49/mês por empresa, usuários ilimitados**, e inclui estoque
  com contexto de obra, Gantt, orçamento, daily log, timecard, checklist de segurança e portal do
  cliente. É o pior inimigo comercial de qualquer módulo de estoque que o Pilar construa.
- **Buildertrend** — a partir de ~US$500/mês (terceiro).

### 2. Dependência com lead time de suprimento (a dor #1 dele)

Isso tem nome consagrado na indústria: **procurement log** e **long-lead items**. O padrão de trabalho é
identificar antecipadamente o item de prazo longo, calcular a **data-limite de pedido** puxando para
trás a partir da data em que o material é necessário no canteiro, e sincronizar isso com o cronograma.

- **PLOT** — logística de canteiro + procurement log **sincronizado com cronograma CPM**, determina
  quando o material é necessário no site e evita entrega prematura. Preço não publicado.
- **ConstructivIQ** — conecta procurement e cadeia de suprimento ao cronograma.
- **LeadTime** — app no marketplace do Procore ("Procurement Made Simple"), ou seja, **nem o Procore
  resolve isso nativo**, terceiriza para o marketplace.
- A Procore publica um **template de procurement log em planilha** como isca de conteúdo. Traduzindo:
  no mundo real isso ainda é Excel.

**Este é o achado mais importante da varredura.** A mecânica de "a etapa B depende de A e o insumo de B
tem lead time de 3 dias, logo dispare a compra ao iniciar A" não existe pronta e barata em lugar nenhum.
O monday desloca datas mas não dispara compra. O Procore joga para um app de terceiro. O PLOT é
enterprise e vendido para GC americano. **É espaço aberto.**

### 3. Frota e aluguel de equipamento

É uma categoria própria (rental ERP), não subfeature de gestão de obra.

- **Quipli** — US$6.000/ano por unidade (~US$500/mês), usuários ilimitados, tudo incluso.
- **Point of Rental** — a partir de ~US$540/mês para 3 usuários (terceiro).
- **Texada** — sob consulta, 35+ anos no nicho de equipamento pesado.
- **Brasil:** **LocaFácil a R$99,90/mês** com 30 dias grátis (estoque, clientes, financeiro, atende
  construção civil), além de Eloca, LOC1, Expecto Loc, Locasoftware e Renttix (preço sob consulta).
- **Angola:** **F3M Angola** vende módulo de **gestão de equipamentos** localmente, parceiro Primavera.

Ou seja: o caso do parceiro (empresa amiga com ~10 máquinas fechando por não saber gerir) tem solução
comprável **a R$100/mês no Brasil**. O problema dela não é falta de software.

### Âncoras de preço no Brasil (gestão de obra)

- **Obra Prima**: a partir de **R$399/mês**, 3 planos (Monet até 2 obras, Van Gogh, da Vinci).
- **Vobi**: a partir de **R$103/mês** (terceiro, não confirmado na página oficial).
- Referência do Pilar hoje: R$690/mês em discussão no PRICING v1.

## Frameworks / números

- Régua de lead time: `data de compra = data necessária no canteiro − lead time do fornecedor − folga`.
  Amarrar isso ao **início da etapa predecessora** é o que transforma Gantt decorativo em Gantt que
  obriga alguém a agir.
- Preço-teto do mercado de "obra leve com estoque": **US$49/mês por empresa** (Contractor Foreman).
  Qualquer módulo de estoque no Pilar precisa valer mais do que isso ou vir de graça junto do core.

## Citações

> "Digital procurement logs are designed to replace manual spreadsheets ... automatically synchronize
> with your master construction schedule and submittals." (PLOT)
> "PLOT synchronizes with Critical Path Method (CPM) schedules to determine exactly when material is
> required on-site, eliminating premature deliveries."
> "Contractor Foreman starts at $49/m per company and is the most affordable construction management
> system for contractors."

## Aplicação ao Pilar

- **Roubar:** a **aresta de dependência com offset de suprimento**. É a única das três dores que (a) é
  barata de fazer em cima do que já existe (Fluxos + Gantt + Fornecedores), (b) não tem solução barata
  no mercado e (c) serve tanto obra quanto engenharia de projeto (o mesmo mecanismo modela "só posso
  emitir o projeto elétrico depois que o estrutural aprovar, e a aprovação leva 5 dias").
- **Não roubar agora:** módulo de estoque completo. O grep no código dá **0 hits** para estoque e
  almoxarifado, é módulo novo inteiro (item, saldo por local, entrada, requisição, inventário,
  custo médio) e o ICP declarado (engenharia multidisciplinar de projeto) **não tem canteiro**. Se for
  feito, que seja como consequência do gatilho de compra, não como ERP de almoxarifado.
- **Não roubar nunca (por ora):** frota/locação. É outro negócio, com outro comprador, e já custa
  R$99,90/mês pronto no Brasil. Se virar demanda repetida, é parceria ou integração, não módulo.
- **Ideia do parceiro de cadastrar a si mesmo como fornecedor** para rastrear saldo é um hack esperto e
  revela o caminho barato: **saldo de material como consequência de lançamento de compra**, sem tela de
  almoxarifado. Isso é dias de trabalho, não meses.
- **Alerta comercial:** ao entrar em obra/estoque, o Pilar sai do combate com Vobi/Monograph e entra no
  combate com Contractor Foreman e com ERPs brasileiros de R$399/mês, com mais superfície e menos preço.

## Relacionadas

[[research/aec/monday-com-benchmark-2026.md]]
[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[research/aec/angola-mercado-pagamento-e-regulacao.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]
