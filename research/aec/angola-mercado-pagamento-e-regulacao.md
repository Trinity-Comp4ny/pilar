---
title: "Angola e África lusófona — existe SaaS de construção, quanto custa e por que cobrar de lá é o problema"
source: "other" # imprensa angolana, EY/Cegid/Primavera, EMIS/BNA, sites dos fornecedores
type: "report"
url: "múltiplas — ver Citações"
author: "market-scout-aec"
date_published: "2026-07-24"
date_captured: "2026-07-24"
tags: [gtm, positioning, unit-economics, vertical-saas]
relevance_pilar: "medium"
---

## TL;DR

A tese do parceiro ("nenhuma empresa tem software barato que ajuda nesse nível") **não se sustenta**:
existe SaaS angolano de gestão de obra vendendo a **4.000-5.000 Kz/mês (~US$4-5)** e um ecossistema de
ERPs certificados pela AGT. O que existe de verdade é um **problema de cobrança e de conformidade**:
cartão de débito angolano não paga no exterior há mais de três anos, o BNA limita compra de divisas, e
a factura electrónica passou a exigir **software certificado pela AGT**. Cobrar assinatura recorrente
em Angola a partir do Brasil hoje é **impraticável sem entidade ou parceiro local**, e a âncora de
preço local é ~25-30x abaixo do preço do Pilar.

## Pontos-chave

### Existe SaaS de construção em Angola? Sim.

- **Constrói Já** (angolano, constroija.com): gestão de obra com controlo de custos, **alertas por
  WhatsApp**, gráfico dinâmico de desvio planejado x realizado, orçamento por fase (alvenaria, pintura,
  cobertura), relatório de auditoria em PDF com QR code e marketplace B2B com desconto de fornecedor
  (cita Secil Cimentos e Sika Angola). Claim de marketing: **1.240+ obras ativas em Angola** (não
  auditado). **Não tem** estoque, equipamento nem IA.
  Preço: **5.000 Kz/mês** (1 obra) · **12.000 Kz/3 meses** (~4.000/mês) · **20.000 Kz/6 meses** (~3.333/mês),
  com 3 dias grátis.
- **MANDA ERP** — ERP 100% angolano, **certificado AGT nº 473/2024**, com controle de obra, orçamento e
  imóveis.
- **WINGEC** — solução criada para gestão e controlo de canteiro, feita com técnicos de construção civil
  e obras públicas.
- **F3M Angola** — parceiro Premium da Primavera, com módulo de **gestão de equipamentos**.
- **Cegid Primavera** e **PHC** — presença em Portugal, Angola, Moçambique e Cabo Verde, com módulo de
  obras e orçamentos.
- **ARTSOFT** e **AngOdoo** (Odoo adaptado à realidade fiscal angolana) — certificados AGT.
- **Oracle Primavera P6** no topo, para cronograma de engenharia pesada.

**Conclusão:** o mercado não é vazio, é **fragmentado e barato**. O que falta lá não é software de obra,
é o que o próprio parceiro disse ser a dor #1 dele: **gestão administrativa/organizacional das equipes**.

### Conversão e âncora de preço

- USD/AOA em **15/07/2026: 915,53** (média de 2026 ~915,31, faixa 912-918).
- **4.000 Kz ≈ US$4,37/mês.** O Pilar a R$690/mês ≈ US$127/mês ≈ **116 mil Kz/mês**.
- Diferença de **~26x a 29x** contra o concorrente local. Não é uma questão de comunicar valor melhor.

### Regulação: factura electrónica e certificação AGT

- Entrada em vigor em **01/10/2025**, com período de adaptação sem penalidade até **31/12/2025**, durante o
  qual a AGT validou e certificou os softwares.
- Obrigatória desde **01/01/2026** para grandes contribuintes e fornecedores do Estado, e a partir de
  **01/01/2027** para os regimes geral e simplificado de IVA.
- **Todo software de facturação no mercado precisa ser certificado pela AGT**, com transmissão
  electrónica e em tempo real das operações.
- Impacto direto: qualquer módulo do Pilar que **emita documento fiscal** em Angola exige certificação
  AGT. Se o Pilar for só gestão interna (sem emitir factura), escapa, mas então compete contra ERPs que
  emitem, o que é uma desvantagem estrutural lá.

### Pagamento: aqui mora o bloqueio real

- Há **mais de três anos** os cartões de débito internacionais de bancos angolanos **não fazem pagamento
  nem levantamento no estrangeiro**, por falta de acesso a divisas.
- O **BNA limita a compra de divisas por particular a US$10.000/ano**, com documentação obrigatória.
- Contorno existente: **cartões Visa virtuais** que permitem pagar SaaS (Netflix, Alibaba e afins) em
  kwanzas. Funciona, mas é frágil, individual e não escala para cobrança B2B recorrente.
- O trilho local é o **Gateway de Pagamentos Online da EMIS / Multicaixa Express** (pagamento por número
  de telefone ou QR code), mas exige **TPA virtual contratado num banco angolano**, ou seja, **entidade
  local**. Provedores como AppyPay intermediam a integração.
- O kwanza deve entrar no **SADC-RTGS no 2º semestre de 2026**, permitindo liquidação em kwanza entre
  países da SADC. O Brasil não é SADC, então isso não ajuda o Pilar.

### Contexto de mercado

- Penetração de internet em Angola: **39%** (de 14,3% em 2016 e 33% em 2023).
- TIC representava ~4,9% do PIB em 2023, com projeção de ultrapassar 7% até 2027; investimento em cloud
  e software de gestão projetado para dobrar até 2029 (fontes locais, tom promocional, confiança média).

## Frameworks / números

- Trilha de cobrança viável em Angola, em ordem de fricção:
  1. **Revenda/parceiro local** que fatura em kwanza pelo Multicaixa Express e repassa (o parceiro já se
     ofereceu para comissão). Fricção baixa para o cliente, alta em governança.
  2. **Faturar em USD contra entidade fora de Angola** (holding, filial em Portugal/Dubai). Funciona só
     para empresa grande.
  3. **Cobrança direta por cartão internacional do Brasil.** Bloqueada na prática.
- Custo x retorno do multi-moeda no código: **85 arquivos com `pt-BR`, ~40 com `BRL`**, sem coluna de
  moeda por empresa e sem i18n. Isso é semanas de trabalho para atender um mercado cuja âncora de preço
  é US$4/mês e cujo trilho de cobrança não existe.

## Citações

> "os clientes de bancos angolanos com cartões de débito internacionais não conseguem fazer qualquer
> operação de pagamento ou de levantamento de dinheiro no estrangeiro" (Expansão)
> "todo o software disponível no mercado deve ser certificado pela AGT para a factura electrónica"
> "1.240+ Obras Ativas em Angola" (marketing Constrói Já)

## Aplicação ao Pilar

- **Não internacionalizar agora.** O parceiro é feedback valioso e vetor de distribuição, **não é
  mercado**. Multi-moeda, remover CNPJ/CEP obrigatório e i18n custam caro e destravam um mercado com
  âncora de US$4/mês, sem trilho de cobrança e com exigência de certificação fiscal.
- **O que vale fazer mesmo assim, por higiene de produto (não por Angola):** tornar CNPJ/CEP **opcionais**
  em vez de obrigatórios e permitir **projeto sem cliente**. São correções de rigidez que também
  incomodam cliente brasileiro (projeto interno, cliente pessoa física, cadastro incompleto). Isso é
  horas, não semanas, e não exige decidir nada sobre internacionalização.
- **Multi-moeda de verdade é dado, não formatação.** Trocar o `Intl.NumberFormat` não resolve: exige
  moeda por empresa, taxa na data do lançamento e relatório consolidado. Se um dia for feito, é ADR.
- **Aproveitar o parceiro do jeito certo:** ele vale como (a) testador de fluxo real numa obra de
  hospital, (b) fonte da mecânica de lead time de suprimento, que serve ao ICP brasileiro também, e
  (c) canal futuro por revenda. Não vale como justificativa para reescrever a camada financeira.
- **Sinal de mercado a guardar:** a dor que ele repetiu não foi obra, foi **"quero saber o que cada
  equipe está fazendo e se a empresa está batendo os objetivos"**. Isso é a mesma pergunta do ICP
  brasileiro, com outra roupa, e o Pilar responde melhor por margem por projeto do que por board de
  tarefas.

## Relacionadas

[[research/aec/suprimento-estoque-e-frota-concorrentes.md]]
[[research/aec/monday-com-benchmark-2026.md]]
[[docs/strategy/PRICING.md]]
