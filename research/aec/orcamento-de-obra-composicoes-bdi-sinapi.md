---
title: "Orçamento de obra — composição de custo unitário, encargos/leis sociais, BDI, bases de referência (SINAPI/TCPO/SICRO), curva ABC e orçado x realizado"
source: "other" # blog Sienge + Caixa/SINAPI + DNIT/SICRO + Orçafáscio + artigos técnicos BR
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, positioning, moat, pricing]
relevance_pilar: "high"
---

## TL;DR

Conhecimento de domínio de orçamentista para os agentes do Pilar. **Orçamento de obra
brasileiro tem uma gramática padronizada e pública**: o preço de venda de um serviço é
`custo unitário direto × (1 + BDI)`, onde o **custo unitário direto** vem de uma
**composição** (coeficientes de consumo de material + mão de obra + equipamento por unidade
de serviço) e o **BDI** (Benefícios e Despesas Indiretas) é o multiplicador que cobre custos
indiretos, tributos, risco e lucro. As **composições** são padronizadas em bases públicas
(**SINAPI** para edificação, **SICRO** para rodovia/infra) e privadas (**TCPO/PINI**). O
detalhe que trava iniciante: **desonerado x não desonerado** (troca dos 20% de INSS patronal
pela contribuição sobre receita) muda o custo da mão de obra, e **encargos/leis sociais**
somam **~157% sobre o horista** e **~99% sobre o mensalista** no SINAPI onerado. **BDI de
edificação fica em ~20-25%** (faixa TCU 2622/2013). Curva ABC ordena insumos/serviços por
peso para focar controle nos ~20% que valem ~80%. **Filtro de ICP: isto é o mundo da
construtora, não do escritório de engenharia.** O ICP do Pilar em geral **não faz orçamento
de execução completo** (não fornece mão de obra nem compra material em escala): ele faz
**proposta/honorário** e, quando administra obra, **presta contas do custo realizado**. O que
importa para o Pilar não é replicar SINAPI+BDI, é **orçado x realizado por etapa** ligado às
cotações (spec 018) e ao custo da conta da obra.

## Pontos-chave

### 1. A equação-mãe do orçamento

Preço de venda de um serviço = **custo direto unitário × (1 + BDI)**, multiplicado pela
quantidade levantada (o quantitativo, coberto na nota `obra-etapas-quantitativos`). Três
camadas, com nomes exatos que o orçamentista usa:

- **Custo direto:** o que se gasta fisicamente no serviço (material + mão de obra +
  equipamento). Sai da **composição de custo unitário**.
- **Custo indireto + tributo + risco + lucro:** entra via **BDI**, um percentual aplicado
  sobre o custo direto. Não se orça item a item, é multiplicador.
- **Quantitativo:** quantas unidades de cada serviço (m², m³, kg, m, un). Vem do projeto/
  takeoff ou de índices por m².

Planilha **sintética** = resumo por serviço (uma linha por serviço, com custo unitário e
total). Planilha **analítica** = abre cada serviço na sua composição (todos os insumos e
coeficientes). Todo sistema sério gera as duas.

### 2. Composição de custo unitário (insumo x serviço)

**Insumo** = item elementar de compra (saco de cimento, hora de pedreiro, hora de
betoneira). **Serviço** (ou "composição") = receita que combina insumos com **coeficientes**
para produzir 1 unidade (ex.: 1 m² de alvenaria, 1 m³ de concreto, 1 m de tubo). O
**coeficiente** é consumo/produtividade por unidade: quantos kg de aço, quantas horas de
pedreiro etc. entram em 1 unidade do serviço.

- Três categorias na composição: **material**, **mão de obra**, **equipamento**.
- O coeficiente de mão de obra é geralmente **produtividade** (h/unidade, ex.: 0,5 h de
  pedreiro por m² de reboco); pequenas variações no coeficiente movem muito o total (fonte
  Sienge cita produtividade de trator variando ~20% e mudando a viabilidade).
- Exemplo do próprio Sienge: alvenaria de 3 m³ = 1 pedreiro + 1 servente em 24 h + 3.285
  tijolos a R$ 0,31 = R$ 1.018,35 só de tijolo; custo unitário = soma dos insumos × coeficiente.
- **Composição pode aninhar composição** (composição auxiliar): o concreto usinado é insumo
  de "concretagem de laje", que é insumo do serviço maior. Bases modelam isso.

Terminologia que aparece: **encargos incidem sobre a mão de obra da composição**, não sobre
material. Por isso desoneração e leis sociais só mexem no bloco de mão de obra.

### 3. Encargos / leis sociais (o número que assusta)

O custo de 1 hora de pedreiro no orçamento **não é o salário/hora**: é salário × (1 + leis
sociais). "Leis sociais" (ou encargos sociais) agrupam INSS, FGTS, 13º, férias, repouso
remunerado, rescisão, EPI, transporte etc. No SINAPI (tabela **onerada**, sem desoneração):

- **Horista (diarista): ~156,70%** de leis sociais sobre o salário-hora. Ou seja, R$ 10/h de
  salário vira ~R$ 25,67/h de custo.
- **Mensalista: ~98,72%**. (mensalista tem menos incidência porque DSR/repouso já está no
  salário mensal).

Fato: percentuais variam por publicação/ano e por convenção; tratar como ordem de grandeza,
não valor fixo. A estrutura de grupos (A = INSS/FGTS/terceiros, B = férias/13º/DSR,
C = rescisão/aviso, D = reincidências A×B) é a metodologia SINAPI/TCPO.

### 4. Desonerado x não desonerado

Regime tributário da folha (Lei 12.546/2011, "desoneração da folha"):

- **Não desonerado (onerado):** mão de obra paga **20% de INSS patronal sobre a folha**.
  Leis sociais mais altas (os ~157%/99% acima).
- **Desonerado:** troca esses 20% por **CPRB** (Contribuição Previdenciária sobre a Receita
  Bruta), tipicamente **~4,5% sobre o faturamento**. Custo de mão de obra na composição cai,
  mas o BDI sobe (a CPRB reaparece como tributo sobre faturamento dentro do BDI).
- **Consequência prática:** não se pode misturar. Orçamento desonerado usa **tabela SINAPI
  desonerada + BDI desonerado**; onerado usa as duas versões oneradas. Errar isso é o erro
  clássico de licitação. Para o Pilar (que não faz licitação), é mais nota de vocabulário do
  que feature.

### 5. Bases de referência: SINAPI, SICRO, TCPO

| Base | Dono | Domínio | Natureza | Atualização | Uso obrigatório |
|------|------|---------|----------|-------------|-----------------|
| **SINAPI** | Caixa + IBGE | Edificação predial (casas, escolas, hospitais) | Pública, gratuita | Mensal, por estado | Obras com recurso Caixa/MCMV/federal de edificação |
| **SICRO** | DNIT | Rodovia/infra de transporte (pavimento, ponte, drenagem, sinalização) | Pública, gratuita | Trimestral, por estado | Obras rodoviárias federais (exigido por TCU/CGU) |
| **TCPO** | Editora PINI (privada) | Edificação, mais detalhada/didática | Paga (livro/software) | Edições esporádicas | Nenhum (referência de mercado, não oficial) |

- **SINAPI** publica mensalmente, por UF e por regime (desonerado/não), tabela **sintética**
  (preços de serviço) e **analítica** (composições abertas). É a espinha dorsal do orçamento
  público de edificação no Brasil.
- **SICRO** é o análogo para rodovia; metodologia própria (inclui custo horário de
  equipamento, DMT = distância média de transporte). Em obra mista (estrada + guarita), usa-se
  SICRO no rodoviário e SINAPI na edificação.
- **TCPO** (Tabelas de Composições de Preços para Orçamentos, PINI) é a bíblia privada de
  coeficientes; muito usada em obra privada porque é mais granular que SINAPI. Paga.
- Fora da tríade: **CUB** (custo unitário básico por m², Sinduscon/estado, para
  pré-orçamento paramétrico), **SIURB/SBC** e tabelas estaduais/municipais. CUB e índices por
  m² estão na nota `obra-etapas-quantitativos` — não repetir aqui.

### 6. BDI (Benefícios e Despesas Indiretas)

Multiplicador que transforma custo direto em preço. **Fórmula de referência do TCU (Acórdão
2622/2013)**:

```
BDI = [ (1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − T) ] − 1
```

- **AC** = administração central (escritório, overhead da empresa)
- **S** = seguros
- **R** = risco
- **G** = garantia
- **DF** = despesas financeiras (custo do capital de giro durante a obra)
- **L** = lucro
- **T** = tributos sobre faturamento (PIS 0,65% + COFINS 3% + ISS 2-5% + CPRB se desonerado)

Repare que **lucro entra no BDI**, não é linha do custo direto. E **tributo divide** (`/(1−T)`)
porque incide sobre o preço final, não sobre o custo.

**Faixas TCU 2622/2013 (1º ao 3º quartil), edificação e afins:**

- Construção de edifícios: **20,34% a 25,00%**
- Rodovias/ferrovias: 19,60% a 24,23%
- Saneamento: 20,76% a 26,44%
- Energia elétrica: 24,00% a 27,86%
- Obras portuárias: 22,80% a 30,95%
- **Fornecimento de material/equipamento: 11,10% a 16,80%** (BDI reduzido, sem mão de obra)

Regra prática: BDI de edificação fora de ~20-25% em licitação pública levanta glosa. Obra
privada tem liberdade, mas a faixa serve de âncora.

### 7. Curva ABC (Pareto 80/20)

Ordena itens do maior para o menor peso no orçamento e classifica:

- **A:** poucos itens que somam ~50-80% do custo (foco de negociação e controle)
- **B:** intermediários, ~30-40% (soma acumulada até ~90-95%)
- **C:** cauda longa de muitos itens de baixo valor, ~10-20%

Existem três curvas ABC distintas (Sienge separa):

- **ABC de insumos:** onde o dinheiro do material/mão de obra está concentrado (ex.: aço +
  concreto + cerâmica costumam ser classe A). Guia a compra.
- **ABC de serviços:** quais serviços pesam mais (estrutura, alvenaria).
- **ABC de apropriações:** os valores **realizados** (lançados/gastos de verdade), não o
  orçado. É a ponte para orçado x realizado.

Uso: com Pareto, o gestor negocia forte os ~20% classe A (onde 1% de economia é dinheiro
real) e não perde tempo cotando parafuso.

### 8. Orçado x realizado (apropriação de custo) e orçamento meta

- **Apropriação de custos** = lançar o gasto real (nota fiscal, folha, medição) **contra o
  item de orçamento correspondente**, para comparar previsto com realizado. É o que fecha o
  ciclo: sem apropriação, o orçamento é só uma peça de proposta.
- **Orçamento meta (custo meta):** o orçamento inicial (comercial/de venda) é "engordado" com
  margens de segurança; o **orçamento meta** é o custo-alvo enxuto que a obra deve perseguir na
  execução, sem as gorduras. Construtora orça duas vezes: um para vender, outro (meta) para
  gerir. Desvio = realizado − meta.
- **Curva S** cruza o avanço físico-financeiro planejado x realizado no tempo (coberto na nota
  de etapas). ABC de apropriações + curva S + orçamento meta é o tripé de controle de custo de
  obra de construtora.

## Frameworks / números

- Equação: **preço = custo direto unitário × (1 + BDI) × quantidade**.
- Leis sociais SINAPI onerado: **horista ~156,70%**, **mensalista ~98,72%** sobre o salário.
- Desoneração: 20% INSS patronal → **CPRB ~4,5% sobre receita** (mão de obra cai, BDI sobe).
- BDI edificação (TCU 2622/2013): **~20,34%-25,00%**; material puro **~11-17%**.
- Fórmula BDI TCU: `[(1+AC+S+R+G)(1+DF)(1+L)/(1−T)] − 1`. Lucro no BDI; tributo divide.
- Tributos em T: PIS 0,65% + COFINS 3% + ISS 2-5% (+ CPRB se desonerado).
- Curva ABC: A ~50-80% do valor em ~20% dos itens; C ~10-20% do valor na cauda longa.
- Bases: SINAPI (mensal, edificação, Caixa/IBGE), SICRO (trimestral, rodovia, DNIT), TCPO
  (paga, PINI).

## Citações

> "Nas tabelas ONERADAS (SEM DESONERAÇÃO), para a mão de obra do HORISTA foram acrescidas LEIS
> SOCIAIS de 156,70% e para a mão de obra do MENSALISTA de 98,72%." (declaração metodológica SINAPI, ifb.edu.br)

> "BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − T)] − 1 ... edificações 20,34%–25,00%
> (1º ao 3º quartil)." (Acórdão TCU 2622/2013, via sienge.com.br e zenite.blog.br)

> "Para os relatórios de Curva ABC de Insumos e Serviços, são levados em conta os valores
> totais orçados; já no relatório de Curva ABC de Apropriações, são apurados os valores
> lançados nos itens de orçamento." (ajuda.sienge.com.br)

## Aplicação ao Pilar

**Filtro de ICP primeiro.** SINAPI + BDI + composição + orçamento meta é o ferramental da
**construtora/incorporadora** (quem executa, compra material em escala e fornece mão de obra).
O ICP do Pilar (engenharia multidisciplinar civil/estrutural/MEP) **em geral não faz orçamento
de execução completo**: ele vende **projeto/consultoria/gestão**, cobra **honorário**, e no
máximo **administra** a obra por conta do cliente. Portanto, a maior parte deste corpo de
conhecimento é **overkill de construtora para o produto** e serve mais para **letramento dos
agentes** (entender o vocabulário do cliente) do que para virar feature.

O que **cabe** no ICP e amarra ao que já existe:

- **Proposta/honorário ≠ orçamento de execução.** Em Propostas, o "orçamento" do Pilar é
  **preço do serviço de engenharia** (horas × valor-hora, ou % da obra, ou valor fechado), não
  planilha SINAPI. Não construir orçamento de execução em Propostas: seria vender feature de
  construtora para quem não é construtora. O paralelo útil do BDI aqui é o **markup do
  escritório** (overhead + lucro sobre o custo-hora), um conceito de precificação de serviço,
  não de obra.
- **Orçado x realizado por etapa é o encaixe real.** Quando o escritório **administra** a obra
  (caso VRZ, memória do módulo Obra), o valor não é orçar com SINAPI, é **prestar contas**:
  quanto foi previsto por etapa vs quanto saiu da **conta da obra** (spec 016) e das
  **cotações** (spec 018). Aqui o conceito de **apropriação de custo** e **curva ABC de
  apropriações** é diretamente aplicável: agrupar o gasto realizado por etapa/insumo e mostrar
  onde o dinheiro está indo. Isso é o loop projeto → execução → custo real que os ERPs de
  construtora não fazem para o escritório.
- **Cotações (spec 018) já são "composição light".** Uma cotação de material por fornecedor é,
  na prática, o nível de insumo. Uma **curva ABC simples sobre as cotações/gastos da obra**
  (ordenar por valor, marcar os itens classe A) é uma feature barata, ICP-fit e defensável, sem
  precisar importar SINAPI. É o pedaço do orçamento que faz sentido para quem administra, não
  para quem executa.
- **Estoque (spec 019) fecha o outro lado:** entrada nasce da cotação (custo real de compra),
  baixa no RDO. Casado com orçado x realizado, dá "quanto comprei vs quanto previ vs quanto
  ainda tenho".
- **Não importar SINAPI/TCPO como base de orçamento.** É trabalho de construtora, exige
  manutenção mensal por UF e regime (des/onerado), e o comprador do Pilar não licita. Se algum
  dia entrar, é **referência de consulta** (link/valor médio para sanity-check de cotação), não
  motor de orçamento. Marcar como fora de escopo consciente.
- **Letramento do agente:** o copiloto deve reconhecer os termos (BDI, desonerado, composição,
  curva ABC, orçamento meta) quando o cliente falar, e traduzir para o que o Pilar faz (custo
  realizado por etapa), sem prometer orçamento de execução. Separa o Pilar do Sienge sem fingir
  ser Sienge.

## Relacionadas

[[research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md]]
[[research/aec/suprimento-estoque-e-frota-concorrentes.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]
[[docs/specs/018-cotacoes-na-obra.md]]
[[docs/specs/019-estoque-da-obra.md]]

## Fontes

- Composição/custo unitário: sienge.com.br/blog/como-fazer-a-composicao-de-custo-unitario-de-sua-obra ;
  maiscontroleerp.com.br/composicao-de-custos ; orcafascio.com/papodeengenheiro/entenda-como-funciona-a-sinapi
  (acessadas 2026-08-11)
- Encargos/leis sociais: ifb.edu.br (ANEXO IV PB Encargos Sociais, declaração SINAPI, horista 156,70% / mensalista 98,72%) ;
  SINAPI Manual de Metodologias e Conceitos (procempa/cercomp.ufg.br) (2026-08-11)
- Desonerado x não desonerado: i9orcamentos.com.br/precos-desonerados-e-nao-desonerados ;
  sienge.com.br/blog/tabela-sinapi-no-orcamento-da-obra (2026-08-11)
- BDI: sienge.com.br/blog/acordao-26222013 (Acórdão TCU 2622/2013) ; zenite.blog.br/qual-e-a-composicao-de-bdi ;
  jus.com.br/artigos/23192 ; suporte.altoqi.com.br/hc/pt-br/articles/4403484163479 (2026-08-11)
- Bases SINAPI/SICRO/TCPO: buscadorsinapi.com.br/guias/sinapi-vs-sicro ; buscadorsicro.com.br/blog/sicro-vs-sinapi ;
  iposespecializacao.com.br/blog/sinapi-sicro-e-tcpo ; orcafascio.com/papodeengenheiro/sicro (2026-08-11)
- Curva ABC / apropriação: sienge.com.br/ebook-curva-abc ; ajuda.sienge.com.br (Curva ABC de Apropriações) ;
  i9orcamentos.com.br/curva-abc-orcamento-de-obras (2026-08-11)
</content>
</invoke>
