---
title: "Síntese — conhecimento de domínio de obra (8 notas) traduzido em decisão de produto para o Pilar"
source: "other" # síntese das 8 notas da leva AEC 2026-08-11 (Sienge/Prevision/Starian + PMBOK + fontes BR)
type: "report"
url: "múltiplas — ver as 8 notas linkadas"
author: "market-scout-aec (síntese do coordenador)"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, positioning, moat, icp, metrics, ai-agents, pricing]
relevance_pilar: "high"
---

## TL;DR

Vasculhamos o corpo de conhecimento que Sienge/Prevision (agora **Starian**, spin-off da Softplan)
ensinam no blog e nos dois canais de YouTube, corroborado por PMBOK e fontes técnicas BR, e
destilamos em 8 notas de domínio. A conclusão não é uma lista de features a copiar: é **uma tese
convergente e um filtro**. A tese: o loop defensável do Pilar é **medição/RDO → avanço % por etapa →
curva S físico-financeira → alerta de margem, expresso em linguagem de dono ("previsto vs real",
"atrasado"), com a matemática de EVM rodando por baixo mas nunca exposta como SPI/CPI**. Isso é a
materialização literal da tagline "saiba se cada projeto está dando lucro antes de terminar". O filtro:
o ICP da Starian é **construtora/incorporadora que vende unidade** (VGV, funding, CRM imobiliário,
fiscal/contábil, folha grande); o ICP do Pilar é **engenharia multidisciplinar enxuta que vende
projeto/horas**. ~70-80% do que eles constroem é peso morto para nós. Todo o conhecimento capturado
serve para **falar a língua do domínio e traduzir para o pouco-e-suficiente**, não para virar ERP.

## Pontos-chave

### 1. A tese convergente (3 notas apontaram para o mesmo ponto sozinhas)

Cronograma, EVM e KPIs chegaram independentes à mesma conclusão: o núcleo é a **curva S
físico-financeira leve**. Schema mínimo por etapa da obra:

- `peso %` (baseline, quanto a etapa representa do todo)
- `avanço % medido` (vem do RDO / medição)
- `custo previsto` e `custo real` (vem de cotações 018 + estoque 019 + conta da obra 016)

Disso deriva tudo que importa: Valor Agregado (VA = avanço% × orçamento), custo real (AC), e a
projeção de estouro (EAC/VAC). **Dois números — "previsto vs real" e "no prazo / atrasado" — são
EVM completo traduzido.** Ver [[planejamento-e-cronograma-de-obra]], [[controle-custos-medicao-e-valor-agregado]].

### 2. A trava real não é a matemática, é a mão de obra

`useRentabilidade` ignora mão de obra (memória de bug conhecida). VA e custo realizado assentam sobre
**custo total**. Sem MO, o IDC parece melhor do que é e o EAC subestima o estouro. **Fechar o buraco
de MO é pré-requisito de qualquer número preditivo confiável**, não uma feature paralela. Esta é a
decisão de produto mais importante da leva inteira.

### 3. O filtro de ICP é uma regra reutilizável, não um caso a caso

A Starian/Prevision serve quem **vende unidade**: precisa de orçamento de execução SINAPI+BDI, curva
ABC de insumos, CPM completo, linha de balanço, eSocial S-1005, CPRB, PGR, gestão de ativos, BIM 5D.
O escritório de engenharia **não faz nada disso** — ele projeta, assume responsabilidade técnica (ART),
e às vezes **administra** a obra (regime cost-plus, ADR 0013). Regra para os agentes decidirem escopo:

> Se a feature só faz sentido para quem tem SESMT, PMO, ou vende m² de apartamento → é peso de
> construtora, fora de escopo. Se ela ajuda o sócio a saber se o projeto dá lucro e a prestar contas
> ao dono → é o Pilar.

### 4. IA por voz/WhatsApp já é commodity do vertical

O Prevision **já** responde status/avanço/atraso por áudio no WhatsApp. Voz no canteiro não é
diferencial. O ângulo distinto do Pilar é a **pergunta de margem** ("quanto sobrou no projeto X?",
"esse aditivo cobre o custo extra?"), que o app de construtora não responde porque não vê o honorário
do escritório. Ver [[sienge-prevision-intel-competitiva-e-conteudo]], [[agentes-executores-work-management-e-aec]].

### 5. O ativo copiável é a máquina de conteúdo, não o produto

O que torna a Starian autoridade não é o ERP, é o **SEO** (blog com 14 clusters + 2 canais de YouTube).
É o moat mais barato disponível e o que eles fazem melhor. Não copiar o produto; escolher **2-3
clusters de dor do nosso ICP** (lucro do projeto, orçado vs realizado, aditivo/escopo) e virar
autoridade neles.

## Frameworks / números (vocabulário para os agentes conversarem com o cliente)

| Conceito | O que é | Cabe no Pilar? |
|---|---|---|
| Curva S físico-financeira | avanço acumulado físico vs financeiro no tempo | **Sim, núcleo** (leve) |
| VA / EV, IDC/CPI, IDP/SPI, EAC/VAC | métricas de valor agregado (PMBOK) | Cálculo sim; expor SPI/CPI cru **não** |
| BDI | markup sobre custo direto (TCU 2622/2013, edif. 20-25%) | Só como analogia do markup do escritório |
| SINAPI/SICRO/TCPO | bases de custo de execução | **Não** (é orçamento de construtora) |
| Curva ABC | ordenar itens por valor (20% valem 80%) | **Sim**, sobre cotações da 018 |
| Mapa de cotação | comparativo ≥3 fornecedores (preço/prazo/condição) | **Sim, é a tela da 018** |
| Regimes de contrato | global / unitário / **administração (cost-plus)** | Administração = o regime do ICP |
| RUP | Homem-hora por unidade física | **Não** (exige apontar Hh, fricção que matou timesheet) |
| PPC (Last Planner) | % do planejado da semana que foi feito | Versão leve, talvez |
| ART/RRT | responsabilidade técnica no CREA/CAU | **Sim**, campo por disciplina |
| BIM 4D/5D, IFC | modelo de informação, quantitativo por query | **Tarpit** — só importar planilha exportada |
| eSocial, CPRB, retenção INSS/ISS, PGR | obrigações fiscais/trabalhistas de canteiro | **Não** (é da construtora/dono) |

## Mapa de decisão de produto (o que fazer com isso)

**Fazer agora / reforça o que já está codando:**
- **Fechar mão de obra em `useRentabilidade`** antes de qualquer número preditivo. (pré-requisito)
- **Specs 018/019 estão certas e minimais.** Nomear a tela como "mapa de cotação"; usar "recebimento/
  entrada", "saldo em canteiro". Prever a **cesta multi-item** no schema sem fechar a porta. **Não**
  adicionar aprovação/orçamento-base antes de cotar (atrito morto para o sócio que cota).
- **Cotação aprovada = custo comprometido.** É o alerta precoce de estouro mais barato de implementar,
  e casa 018 (cotação) com o controle de custo.
- **Curva ABC sobre gastos/cotações** como lente "onde o dinheiro está indo" — sem importar SINAPI.

**Fazer a seguir (roadmap Obra):**
- **Curva S físico-financeira leve** por etapa, alimentada pelo avanço do RDO (spec 015). Expor em
  linguagem de dono. É a feature de maior encaixe da leva.
- **Campo de ART/RRT por disciplina** (número, CREA/CAU, RT, status, link do PDF) + **alerta ambient**
  de RT reusando o motor `gerar_alertas`. Reforça a tese "número + documento confiável / audit-ready".
- **Importador de planilha de quantitativo** (colar/subir CSV) reusando o pipeline da spec 017 —
  atende quem tem BIM e quem não tem com o mesmo custo, sem tocar em IFC.
- **Checklist de aceite/conformidade por etapa** (FVS enxuta + docs alvará/habite-se/CND como link),
  vira insumo de prestação de contas quando o ICP administra a obra.

**Não fazer (teatro de construtora, o Pilar perde para ERP mais barato):**
- Orçamento de execução SINAPI+BDI; CPM completo (folga/rede PERT); linha de balanço; Last Planner
  colaborativo com subempreiteiros; RUP/apontamento de Hh; TF/TG e PGR/APR completos; motor BIM/IFC/
  takeoff/5D; cálculo de CPRB/desoneração; eSocial S-1005; CRM imobiliário/funding/gestão de ativos.
- Expor SPI/CPI cru na UI. Sem baseline de cronograma (que o ICP não mantém), SPI é número falso;
  oferecer "prazo" só como marcos batidos/atrasados.

**GTM / moat:**
- Posicionar como **"o leve por design"** contra a gravidade do ERP. A própria existência do "Gestor
  Obras" (Starian) prova que o carro-chefe afasta o pequeno. Copy: sem implantação, sem 8 módulos de
  incorporação.
- **Máquina de conteúdo SEO** em 2-3 clusters de dor do ICP. Moat mais barato disponível.
- IA: diferenciar na **pergunta de margem**, não em avanço físico por voz (já é commodity).

## Citações

> A trava é a mão de obra, não o EVM. Sem MO, o IDC parece melhor do que é e o EAC subestima o estouro.
> — nota de controle de custos/EVM

> ~70-80% das features deles são peso morto para nós. O ativo mais forte e mais copiável não é o
> produto, é a máquina de conteúdo SEO. — nota de intel Sienge/Prevision

## Aplicação ao Pilar

Esta síntese existe para ser lida por `product-manager`, `engenheiro-icp`, `pricing` e `critico-red-team`
antes de qualquer decisão do módulo Obra. Ela responde três perguntas de produto que estavam abertas:
(1) **o que cortar das specs 018/019** — nada do núcleo, mas resistir a aprovação-antes-de-cotar e a
almoxarifado; (2) **se BIM entra no roadmap** — não como motor, só como importador de planilha; (3)
**qual a próxima feature de Obra** — curva S leve alimentada pelo RDO, depois de fechar MO no
`useRentabilidade`. A tese "linguagem de dono por cima, EVM por baixo" é a diretriz de UX de todo o módulo.

## Relacionadas

[[planejamento-e-cronograma-de-obra]] · [[orcamento-de-obra-composicoes-bdi-sinapi]] ·
[[controle-custos-medicao-e-valor-agregado]] · [[suprimentos-compras-cotacao-contratos-fluxo]] ·
[[kpis-produtividade-qualidade-seguranca-obra]] · [[normas-regulacao-e-obrigacoes-obra-br]] ·
[[bim-4d-5d-e-integracao-projetos]] · [[sienge-prevision-intel-competitiva-e-conteudo]] ·
[[obra-etapas-quantitativos-e-ferramentas-campo]] · [[proactive-margin-agent-landscape]] ·
[[obra-por-administracao-prestacao-de-contas-mercado-br]]
