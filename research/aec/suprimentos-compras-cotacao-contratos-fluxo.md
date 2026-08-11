---
title: "Suprimentos na obra: o fluxo requisição→cotação→pedido→recebimento→NF→pagamento, contratos e curva de suprimentos (o processo, não os concorrentes)"
source: "other" # Sienge (blog + central de ajuda), Obra Prima, Mais Controle, Prevision, TCU, OrçaFascio
type: "report"
url: "múltiplas — ver Citações"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, positioning, moat]
relevance_pilar: "high"
---

## TL;DR

O setor tem um **vocabulário consolidado** para comprar material de obra: o ciclo canônico é
**requisição/solicitação de compra → cotação (com mapa comparativo de N fornecedores) → pedido/ordem
de compra → recebimento → nota fiscal → pagamento**, planejado a partir do **cronograma** via
**cronograma/curva de suprimentos**. Isso é o coração do ERP de construtora (Sienge), onde material
chega a 50% do valor da obra e o processo é pesado, com aprovação, orçamento-base e curva ABC. A spec
018 (cotação) e a 019 (estoque) do Pilar estão implementando **uma fatia mínima e correta** desse
fluxo, propositalmente sem o peso enterprise: a cotação item-único com decisão registrada é o "mapa de
cotação" enxuto, e o estoque como lente sobre a compra é o "recebimento + saldo" sem virar almoxarifado.
O risco não é fazer de menos, é **escorregar para o ERP** (requisição formal, orçamento-base, curva ABC,
PEPS) que o ICP informal não vai usar.

## Pontos-chave

### 1. O ciclo canônico de suprimentos (terminologia exata)

O Sienge organiza o "Fluxo de Compras" em etapas nomeadas, e o insumo é apresentado "de acordo com cada
etapa: **solicitação, cotação, pedido e nota fiscal**". Destrinchando com a terminologia do setor:

1. **Requisição / Solicitação de compra** — "a etapa inicial do Fluxo de Compras", sinaliza a
   necessidade de comprar material ou contratar mão de obra. Campos no Sienge: **obra** (tem que estar
   "Em Andamento", não "Orçamento"), **solicitante**, **departamento** (opcional), **insumo(s)** com
   **quantidade e unidade de medida** obrigatórias, **previsão de entrega** e visão do **estoque atual**
   do insumo. Passa por **verificação da equipe de suprimentos** que checa se bate com o **cronograma**
   e com os **limites orçamentários** já definidos. Ou seja: requisição não é compra, é um **pedido
   interno que vira aprovação**.
2. **Cotação** — coleta de orçamentos de **múltiplos fornecedores** para o(s) insumo(s) requisitado(s).
   Materializa no **mapa de cotação** (ver item 2).
3. **Pedido / Ordem de compra (OC)** — documento que **formaliza a aquisição** junto ao fornecedor
   vencedor, com preço, prazo, condição de pagamento. "Após a decisão final do fornecedor" o mapa vira
   pedido.
4. **Recebimento** — entrega no canteiro com **inspeção e conferência** (quantidade, qualidade, bate com
   a OC). Passo tratado como controle-chave: "controle de recebimento de material no canteiro" evita
   pedido duplicado e desvio.
5. **Nota fiscal (NF)** — documento fiscal do fornecedor; no Sienge é etapa própria do fluxo, casada
   com o pedido e o recebimento (conferência NF × pedido × entrega).
6. **Pagamento** — a NF conferida vira **conta a pagar** no financeiro, respeitando a **condição de
   pagamento** negociada na cotação.

Confiança: **alta** para a nomenclatura (fonte primária Sienge, central de ajuda + blog). A ordem exata
NF-antes-ou-depois-do-recebimento varia por operação; o padrão é recebimento físico → conferência da NF.

### 2. Mapa de cotação (o quadro comparativo)

**Definição consensual** (Sienge, Mais Controle, Catallog, Obra Prima): "tabela comparativa que reúne
todas as propostas de fornecedores para um determinado item, serviço ou lote", também chamada **mapa
comparativo de preços**. Estrutura:

- **Linhas** = itens/insumos cotados. **Colunas** = fornecedores, cada um com **preço, prazo de entrega,
  condição/forma de pagamento, marca/qualidade, e dados do fornecedor** (contato, confiabilidade,
  histórico, localização).
- **Regra prática citada:** pelo menos **3 fornecedores** por cotação ("garantindo diversidade de
  propostas"). Isso é exatamente o "peguei 3 orçamentos" da spec 018.
- **Critério de decisão não é só menor preço:** o mapa força análise equilibrada de **preço total**
  (com frete e impostos), **prazo**, **condição de pagamento** e **marca/qualidade/conformidade com
  norma**. O valor institucional do mapa é **transparência e antifavorecimento**: "impede favorecimentos
  indevidos" e "evita escolhas baseadas em preferências pessoais". No Pilar isso vira o argumento de
  **prestação de contas** ("justificar a escolha para o cliente"), que é a razão-de-ser da spec 018.
- **Saída:** decisão → pedido de compra; e acompanhamento de **savings** (economia obtida vs. maior
  orçamento) no financeiro.

### 3. Contratos: os três regimes (e por que o ICP do Pilar é "administração")

Terminologia de contrato de execução (fonte TCU/OrçaFascio, primária para o conceito):

- **Empreitada por preço global (EPG)** — "preço certo e total" pela obra inteira. **Medição e
  pagamento por marco/etapa** concluída, definidos num **eventograma**. Usa-se quando dá para prever as
  quantidades com boa precisão. É o modelo de **marcos** que o Pilar já tem em Projetos/Propostas.
- **Empreitada por preço unitário (EPU)** — "preço certo de unidades determinadas"; os quantitativos
  são **referenciais**, aferidos e pagos conforme **medição do fiscal**. Usa-se quando não dá para
  cravar quantidade. Medição de contrato = o motor de dinheiro aqui.
- **Administração (por administração / cost-plus)** — remuneração = **custos efetivamente realizados +
  taxa/percentual de administração**. É exatamente o modelo do **ADR 0013 e das specs 016/018/019**:
  dois bolsos (dinheiro do cliente × custo da obra) e uma lente, com a **taxa de administração** aplicada
  sobre o custo. Neste regime a **prestação de contas item-a-item é o produto** (o cliente paga o custo,
  então exige ver cada compra), o que explica por que cotação e estoque importam tanto no nicho de VRZ.
- **Aditivo** — instrumento que altera o contrato (escopo/quantidade/valor/prazo) depois de assinado. O
  Pilar já modela **aditivos em Projetos**; o conceito de "medição de contrato" (EPU/EPG) é o que **não**
  existe e provavelmente **não deve** existir para o ICP administração.

Implicação de ICP: o Pilar não precisa de "medição de contrato" no sentido de EPU/EPG (isso é
empreiteiro/construtora). O regime do nosso ICP é **administração**, onde o equivalente à medição é a
**prestação de contas de custo** que as specs 016/018/019 já constroem.

### 4. Planejamento de compras a partir do cronograma (curva de suprimentos)

O plano de suprimentos "deve ser construído a partir do **cronograma da obra**". Cadeia de artefatos:

- **Cronograma físico (Gantt) → curva S** (avanço acumulado no tempo) **→ histograma de recursos**
  (demanda de material/MO/equipamento por semana) **→ cronograma de suprimentos** ("traduz o
  planejamento físico em necessidades concretas de materiais, com datas para **compra, entrega e uso**").
- Objetivo: "evitar faltas e excessos, acompanhar datas críticas". É a régua de **long-lead / lead
  time** já mapeada na nota de concorrentes: `data de compra = data necessária no canteiro − lead time −
  folga`. Prevision e Sienge vendem isso como planilha isca; **no mundo real ainda é Excel**.
- **Curva ABC de insumos** — segmenta material por valor econômico × frequência de consumo; item A
  (poucos itens, muito dinheiro) merece **contrato de fornecimento** e cotação caprichada, item C vai no
  automático. É um conceito de gestão, não uma tela obrigatória.

Confiança: alta para os conceitos; a amarração automática cronograma→disparo-de-compra **não existe
pronta e barata** (achado da nota de concorrentes), continua sendo espaço aberto.

### 5. Gestão de fornecedores e integrações

- **Seleção de fornecedor** vai além do preço: capacidade de entrega, conformidade legal, reputação,
  saúde financeira, responsabilidade socioambiental; e **relacionamento de longo prazo** para negociar
  prazo/condição. No Pilar o cadastro `fornecedores` já existe (usado pela spec 018), mas o Pilar **não
  faz** scoring/homologação de fornecedor, nem precisa para o ICP.
- **Integração é o valor do ERP:** compras ↔ estoque ↔ planejamento ↔ financeiro num só lugar. O Pilar
  replica essa espinha em escala mínima: cotação (018) → despesa na conta da obra (016) → entrada de
  estoque (019), sem duplicar dinheiro (o vínculo entrada↔despesa é `SET NULL`, não um novo motor).

## Frameworks / números

- **Material = até ~50% do valor da obra** (Sienge). É o que justifica todo o aparato de suprimentos na
  construtora, e é por que "onde o dinheiro do cliente foi" é a pergunta central da obra por administração.
- **Ciclo canônico (guardar como vocabulário do produto):** requisição → cotação (mapa, ≥3 fornecedores)
  → pedido/OC → recebimento (conferência) → NF → pagamento.
- **3 regimes de contrato:** global (marco/eventograma) · unitário (medição do fiscal) · administração
  (custo + taxa). ICP Pilar = **administração**.
- **Cadeia de planejamento:** Gantt → curva S → histograma → cronograma de suprimentos → curva ABC.

## Citações

> "A Solicitação de Compra é a etapa inicial do Fluxo de Compras, sinalizando que é necessário realizar a
> compra de algum material ou contratação de um insumo de mão de obra." (Sienge, central de ajuda, acesso
> 2026-08-11)

> "Os insumos são apresentados de acordo com cada etapa do fluxo: solicitação, cotação, pedido e nota
> fiscal." (Sienge/Construcompras, acesso 2026-08-11)

> "O mapa de cotações é uma tabela comparativa que reúne todas as propostas de fornecedores para um
> determinado item, serviço ou lote de materiais... comparar preços, prazos e condições de pagamento."
> (Sienge / Mais Controle, acesso 2026-08-11)

> "Na administração de obra, a remuneração geralmente está relacionada aos custos efetivamente
> realizados, acrescidos de uma taxa ou percentual de administração." (TCU/SJP, acesso 2026-08-11)

> "Cronograma de suprimentos traduz o planejamento físico em necessidades concretas de materiais...
> especificando datas para compra, entrega e uso." (Prevision/Controle sua obra, acesso 2026-08-11)

## Aplicação ao Pilar

**O que do fluxo enterprise CABE no ICP (engenharia multidisciplinar que administra obra, compra menos
volume e de forma mais informal):**

- **Cotação como "mapa comparativo" enxuto (spec 018) — cabe e é o núcleo.** O setor valida a estrutura
  exata que a 018 escolheu: N propostas por necessidade, colunas **preço / prazo / condição de
  pagamento**, destaque do menor, decisão registrada e justificável. A 018 acerta ao guardar **fornecedor
  livre** (a cotação de campo raramente tem fornecedor cadastrado) e ao ligar a decisão à despesa. Único
  gap conceitual vs. o mercado: o mapa clássico é **por cesta (vários itens, mesmos fornecedores)** e a
  018 é **item-único**. Para o ICP informal, item-único é a escolha certa no MVP; a "cesta" é a evolução
  natural quando a VRZ pedir (é o mesmo padrão de linhas×colunas, só multiplica as linhas).
- **Recebimento + saldo como lente (spec 019) — cabe, do jeito que foi cortada.** O ciclo enterprise tem
  "recebimento com conferência" e "estoque com curva ABC/PEPS"; a 019 pega só a parte que o ICP usa:
  **entrada nasce da cotação/compra, baixa opcional no RDO, saldo derivado** (comprado − aplicado). Isso é
  o "recebimento" e o "saldo de canteiro" sem o almoxarifado. O insight de memória (entrada nasce da
  cotação; baixa opcional; saldo derivado) está **alinhado com o vocabulário do setor** e é a tradução
  pobre-e-suficiente do fluxo rico.
- **Contrato por administração — já é a tese.** O regime do ICP é cost-plus; a "medição" vira **prestação
  de contas de custo**. Não precisa de EPU/EPG nem de eventograma de medição de contrato.

**O que é PESO enterprise (não trazer para o ICP):**

- **Requisição formal com aprovação/orçamento-base.** No ICP quem cota é o próprio sócio; não há
  departamento de suprimentos nem verba pré-aprovada por insumo. A "requisição" do Pilar já é a própria
  **cotação** (a necessidade). Não criar um passo de aprovação interna.
- **Curva ABC, PEPS/UEPS, custo médio complexo, múltiplos depósitos, homologação de fornecedor.** Já
  cortados na spec 019, corretamente. É o território onde o Pilar perde para ERP mais barato.
- **Medição de contrato (EPU/EPG) e eventograma.** Fora do regime administração.
- **Nota fiscal como objeto fiscal.** O ciclo enterprise concilia NF × pedido × recebimento. No ICP a NF
  entra como **anexo por link** e a compra é a despesa; não construir um módulo fiscal.

**3 implicações de produto (foco specs 018/019):**

1. **Adotar o vocabulário do setor na UI da 018/019 para dar autoridade sem custo.** "Cotação", "mapa
   comparativo", "menor preço", "condição de pagamento", "recebimento/entrada", "saldo em canteiro" são
   termos que o comprador do nicho já usa. Usar exatamente esses rótulos (em vez de inventar) faz o
   produto parecer nativo do domínio. Um passo barato: nomear a tela de comparação da 018 como **"mapa de
   cotação"** no texto de apoio.
2. **A "cesta" (multi-item por cotação) é o próximo passo natural da 018, não uma reescrita.** O mercado
   cota lote/cesta; o MVP item-único vai bater no limite quando a VRZ pedir "3 fornecedores para a lista
   de material da laje". Deixar isso explícito como evolução prevista (linhas = itens) evita retrabalho de
   modelo. Não fazer agora, mas não fechar a porta no schema.
3. **A cotação é a "requisição" do ICP: não adicionar um passo de aprovação/orçamento-base.** O fluxo
   enterprise tem requisição→aprovação antes da cotação; para o ICP isso é atrito morto. Manter a 018 como
   está (a necessidade já é a cotação) e resistir à pressão de "aprovar antes de cotar". O gate de valor
   real não é aprovação, é a **prestação de contas depois** (a decisão registrada + a despesa na conta da
   obra), que a 018/016 já entregam.

## Relacionadas

[[research/aec/suprimento-estoque-e-frota-concorrentes.md]]
[[docs/specs/018-cotacoes-na-obra.md]]
[[docs/specs/019-estoque-da-obra.md]]
[[docs/specs/016-conta-da-obra-e-prestacao-de-contas.md]]
[[docs/architecture/adr/0013-financeiro-de-obra-por-administracao-dois-bolsos-uma-lente.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]
