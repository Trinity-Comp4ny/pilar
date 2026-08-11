---
title: "Controle de custos, medição e valor agregado (EVM) na obra — o motor que responde 'esse projeto dá lucro?'"
source: "other"    # Sienge (blog controle de custos/medição/valor agregado), PMI/PMBOK, Prevision
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, metrics, positioning, moat, icp]
relevance_pilar: "high"
---

## TL;DR
Controle de custo de obra "sério" tem um motor bem definido: **medir avanço físico → converter em
valor financeiro (valor agregado) → comparar com o orçado e com o realizado → projetar o custo final
e o desvio antes de acabar.** Esse é o mesmo mecanismo que responde à tagline do Pilar ("saiba se cada
projeto está dando lucro antes de terminar"). O Sienge/Prevision já implementa a versão enterprise
(EVM completo + curva S + medição físico-financeira). O ICP do Pilar (engenharia multidisciplinar,
sem PMO, sem orçamento SINAPI de 800 linhas) **não precisa do EVM inteiro** — precisa de 3 números
confiáveis: **orçado x comprometido x realizado** e uma **projeção de estouro** (EAC). CPI/SPI e curva
S são úteis como leitura, mas SV/SPI e a curva S planejada exigem um baseline de cronograma que o ICP
raramente mantém, então virariam teatro. **A trava real (memória): `useRentabilidade` ignora mão de
obra** — sem custo de MO, valor agregado e "custo realizado" ficam errados na raiz, e qualquer EVM em
cima disso mente.

## Pontos-chave

### 1. Medição de obra: física e financeira
- **Medição** = comparar o executado com o planejado num período (semanal/quinzenal/mensal). Gera o
  **boletim/relatório de medição**: etapas, itens usados (inclusive MO), gasto parcial/total, prazo,
  o que já foi construído. É o boletim que **autoriza o pagamento** ao prestador (empreitada).
- **Física** = % de avanço das atividades/etapas construtivas (ex.: alvenaria 60%). **Financeira** =
  previsto x realizado de custo, integrando cronograma ao fluxo financeiro. As duas são faces do mesmo
  fato: o avanço físico medido é o que vira **valor agregado**.
- **Retenção / glosa** (contrato de empreitada, prática de mercado; o artigo do Sienge não detalha, mas
  é o padrão): a medição aprovada pode sofrer **glosa** (corte do que não foi aceito) e **retenção**
  contratual (segura-se um % de cada medição, liberado na entrega/garantia). Isso separa "medido" de
  "a pagar" de "pago" — três valores distintos.

### 2. Os três custos que não se pode confundir (custo técnico da obra — Sienge)
Este é o alicerce, mais importante que o EVM em si para o ICP do Pilar:
- **Desembolso** (regime de caixa): dinheiro efetivamente **pago**. Pode adiantar ou atrasar em relação
  à execução. Serve fluxo de caixa, **não** mede a saúde econômica da obra.
- **Comprometido** (compromisso assumido): valores **já contratados** com fornecedor/prestador, ainda
  não pagos nem totalmente executados. É o "buraco futuro" que a obra já cavou. **Onde a maioria dos
  estouros se esconde** — o pedido de compra já queimou a margem antes de virar despesa.
- **Custo real / realizado** (regime de competência): custo proporcional ao **avanço físico
  construído**, independente de pagamento ou contrato. É o único comparável ao orçado.
- Regra do artigo: *"não confunda o que foi pago com o que foi construído"*. Fluxo de caixa saudável
  pode conviver com obra dando prejuízo (e vice-versa).

### 3. EVM / Análise de Valor Agregado (PMBOK, com siglas PT)
Três medidas-base, todas na mesma moeda (R$):
- **VP / PV — Valor Planejado** (*Planned Value*): custo **orçado** do trabalho que **deveria** estar
  feito nesta data. É a curva S de baseline. `VP = % planejado × orçamento`.
- **VA / EV — Valor Agregado** (*Earned Value*): custo **orçado** do trabalho **efetivamente feito**
  (medido). `VA = % físico medido × orçamento`. É a ponte medição→dinheiro.
- **CR / AC — Custo Real** (*Actual Cost*): quanto **de fato custou** o que foi feito até aqui.

Derivadas (fórmulas exatas):
- **VC / CV — Variação de Custo** = `VA − CR`. Negativo = gastando mais que o valor entregue (estouro).
- **VS / SV — Variação de Prazo** = `VA − VP`. Negativo = entregou menos que o planejado (atraso), mas
  **medido em R$, não em dias**.
- **IDC / CPI — Índice de Desempenho de Custo** = `VA / CR`. `<1` = ineficiência de custo. Ex.: 0,90 =
  cada R$1 gasto entregou R$0,90 de obra orçada.
- **IDP / SPI — Índice de Desempenho de Prazo** = `VA / VP`. `<1` = atrasado (em valor).
- **EAC — Estimativa no Término** (*Estimate at Completion*): custo final projetado. Fórmula mais usada
  = `EAC = ONT / IDC` (ONT/BAC = orçamento no término). Se o ritmo de ineficiência continuar, é onde a
  obra fecha. Variante pessimista (custo + prazo): `EAC = ONT / (IDC × IDP)`.
- **ETC — Estimativa para Terminar** (*Estimate to Complete*) = `EAC − CR`. Quanto ainda falta gastar.
- **VAC / VNT — Variação no Término** = `ONT − EAC`. Positivo = folga; negativo = **estouro projetado**.
  Este é literalmente o número da tagline: o prejuízo previsto antes de terminar.

### 4. Curva S de controle e projeção de estouro
- **Curva S** = acumulado de VP (planejado), VA (agregado) e CR (real) no tempo. Formato de S porque a
  obra arranca devagar, acelera no meio, desacelera no fim. Três curvas juntas leem custo e prazo de
  uma vez: VA abaixo de VP = atraso; CR acima de VA = estouro.
- **Projeção de estouro**: a partir do IDC atual, EAC/VAC projetam onde a obra fecha **mês a mês**, sem
  esperar o fim. É o "antes que o custo vire prejuízo" da Prevision/Sienge.
- Benchmark citado (Sienge): desvio médio de **21,7% entre custo orçado e real** de obra — magnitude que
  justifica o controle. (fonte secundária, blog Sienge; tratar como ordem de grandeza, não lei.)

### 5. Como isso vira "esse projeto dá lucro?"
Encadeamento: **medição física → VA → comparação com CR (realizado) e comprometido → EAC/VAC → margem
projetada = preço/receita do contrato − EAC.** Se a receita é fixa (preço fechado), a margem é
`receita − EAC`. Se é obra por administração, a "margem" do escritório é a taxa (8-15%) e o EVM serve
para **provar ao dono da obra** que o custo está sob controle (prestação de contas), não para a margem
do escritório. Os dois casos precisam do **mesmo motor de VA + comprometido**.

## Frameworks / números
- Cheat sheet EVM: VC=VA−CR · VS=VA−VP · IDC=VA/CR · IDP=VA/VP · EAC=ONT/IDC · ETC=EAC−CR · VAC=ONT−EAC.
  Leitura rápida: **IDC e VAC** são os dois que respondem "vou fechar no lucro?"; IDP/VS respondem
  "estou no prazo?".
- Três-custos (competência vs caixa): **comprometido** é o alerta precoce; **realizado** é a verdade
  econômica; **desembolso** é só caixa. Errar isso = confundir "tem dinheiro no banco" com "dá lucro".
- Desvio médio orçado→real ~21,7% (Sienge, secundário).
- Medição típica: semanal a mensal, com boletim que autoriza pagamento; retenção/glosa separam medido de
  pago (prática de empreitada).

## Citações
> "Valor Agregado representa o custo orçado do trabalho efetivamente executado, obtido pela medição do
> avanço físico da obra, geralmente por medição mensal dos serviços do empreiteiro." — Sienge, Análise
> de Valor Agregado (2026)
> "Não confunda o que foi pago com o que foi construído." — Sienge, Custo técnico da obra (desembolso x
> comprometimento x custo real)
> "Compare o planejado, executado e previsto para ajustar o orçamento antes que o custo vire prejuízo."
> — Prevision/Sienge (já capturado em proactive-margin-agent-landscape)
> "EAC = BAC / CPI … EAC = AC + (BAC−EV)/(CPI×SPI) usually yields the most pessimistic EAC." — PMI/PMBOK
> (pmi.org, learning library)

## Aplicação ao Pilar

**Fato x estimativa:** as fórmulas de EVM (PMBOK) e a taxonomia de custo (Sienge) são fato. A
recomendação de escopo abaixo é minha análise para o ICP.

- **Ligação direta com a tagline.** VAC (variação no término) É "saiba se o projeto dá lucro antes de
  terminar" traduzido em conta. Se o Pilar entregar **um** número preditivo bem feito, é o VAC/EAC por
  projeto. Tudo o mais é suporte.
- **Filtro de ICP — o que é realista vs teatro enterprise:**
  - **Realista e obrigatório:** os **três custos** (orçado x comprometido x realizado). O ICP entende
    isso sem PMO, e é onde a Prevision/Sienge cobram caro. O "comprometido" (pedido de compra/cotação
    que já queimou margem) é o alerta precoce mais barato de implementar e o mais valioso. **Já casa com
    a spec 018 (cotações na obra) e 019 (estoque): a cotação aprovada vira comprometido.**
  - **Realista com esforço:** **VA + IDC (CPI)** por projeto — exige % de avanço físico. O RDO (spec
    015) já é a fonte natural desse avanço. Com avanço + orçado, sai VA, IDC e EAC. Bom custo-benefício.
  - **Teatro enterprise para o ICP:** **IDP/SPI, VS e a curva S planejada (VP)**. Exigem um **baseline
    de cronograma** confiável (linha de base de datas por etapa) que o ICP quase nunca mantém. Sem
    baseline, VP é chute e SPI mente. Entregar SPI ao ICP hoje = dashboard bonito com número falso.
    Adiar até existir cronograma real; oferecer "prazo" como sinal simples (marcos batidos/atrasados),
    não como IDP.
- **A trava na raiz — `useRentabilidade` ignora mão de obra (memória, reunião Angola 2026-07-24).**
  EVM inteiro assenta sobre "custo realizado". Se o custo de MO não entra, VA e CR ficam subestimados,
  o IDC parece melhor do que é, e o EAC subestima o estouro. **Nenhum EVM no Pilar é confiável antes de
  fechar esse buraco.** É pré-requisito, não feature paralela.
- **Módulo Obra / conta da obra / prestação de contas:** para obra por administração, o EVM não mede a
  margem do escritório (que é a taxa), e sim **prova ao dono que o custo está sob controle**. O boletim
  de medição + os três custos + curva de desembolso viram o **extrato de prestação de contas** já
  mapeado na nota de obra por administração. O VA aqui é linguagem de confiança/auditoria, não de lucro.
- **Não recriar o orçamento SINAPI.** VA precisa de um orçamento-base, mas o ICP do Pilar orça por etapa
  própria (não 800 linhas SINAPI). Ancorar VA no **orçamento por etapa/centro de custo** que o projeto
  já tem, não em base paramétrica de construtora. É o "custo por etapa" do Sienge, versão leve.
- **Posição defensável:** Sienge/Prevision entregam EVM completo para construtora enterprise. O Pilar
  entrega **os 3 custos + EAC/VAC por projeto** para engenharia SMB, ligados ao financeiro que já existe,
  sem exigir PMO nem cronograma-baseline. É "número confiável", não "ferramenta de planejamento".

## Relacionadas
[[research/aec/proactive-margin-agent-landscape.md]]
[[research/aec/obra-por-administracao-prestacao-de-contas-mercado-br.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]
[[docs/specs/018-cotacoes-na-obra.md]]
[[docs/specs/019-estoque-da-obra.md]]

## Fontes
- Sienge — Análise de valor agregado: sienge.com.br/blog/analise-de-valor-agregado/ (acessado 2026-08-11)
- Sienge — Custo técnico da obra (desembolso/comprometimento/custo real):
  sienge.com.br/blog/custo-tecnico-da-obra/ (2026-08-11)
- Sienge — Medição de obras: sienge.com.br/blog/medicao-de-obras/ (2026-08-11)
- Sienge — Curva S da obra: sienge.com.br/blog/curva-s-da-obra/ (2026-08-11)
- Sienge — Gestão/controle de custos + benchmark 21,7%: sienge.com.br/blog/gestao-de-custos-de-obra/ ;
  sienge.com.br/blog/controle-de-custos-como-fazer/ (2026-08-11)
- PMI/PMBOK — EVM (EAC/CPI/SPI): pmi.org/learning/library/earned-value-management-systems-analysis-8026 ;
  pmi.org/learning/library/make-earned-value-work-project-6001 (2026-08-11)
- Prevision/Sienge — antecipação de estouro: já citado em proactive-margin-agent-landscape.md
