---
title: "Módulo Obra — árvore de etapas padrão, quantitativos calculáveis, concorrentes de campo (Sienge/Vobi/Obra Prima/Mobuss), takeoff por PDF e APIs de clima"
source: "other" # portais BR de construção civil + sites de fornecedores + papers
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-07-31"
date_captured: "2026-07-31"
tags: [vertical-saas, positioning, moat, onboarding]
relevance_pilar: "high"
---

## TL;DR

Matéria-prima de campo para o módulo Obra. **A árvore etapa > subetapa > tarefa de uma obra
brasileira é padronizável** (11-12 macroetapas estáveis, ordem cronológica quase invariante), o que
sustenta um **template editável default**. **O quantitativo é surpreendentemente calculável sem projeto
completo**: existem índices de pré-dimensionamento por m² de área construída (concreto ≈ 0,18 m³/m²,
aço 70-100 kg/m³ de concreto, parede 1,8-2,8 m²/m² conforme padrão) usados por orçamentistas todo dia,
consolidados em TCPO/SINAPI. O que muda por tipo de obra (térrea vs sobrado, área, piscina, padrão de
acabamento) é parametrizável em ~5-6 campos de "perfil". No mercado, **planejamento + medição física +
curva S + RDO já é commodity no Sienge/Prevision e Mobuss** (enterprise/construtora), e **RDO isolado
custa a partir de ~R$850/ano**. Takeoff automático por PDF existe mas é **imaturo em 2D** (85-92% de
acurácia em geometria simples, sempre com revisão humana); só amadurece de verdade com BIM/IFC, que o
ICP do Pilar em geral não produz. Clima: **Open-Meteo é a escolha óbvia** (grátis, sem chave, horário,
cobertura BR via modelo global) para cruzar chuva com data de concretagem.

## Pontos-chave

### 1. Árvore etapa > subetapa > tarefa (template padrão editável)

A ordem cronológica é estável entre as fontes BR. Macroetapas grandes e o que penduram:

**0. Serviços preliminares / pré-obra**

- Aprovação e licença: projeto arquitetônico, aprovação na prefeitura, alvará de construção, ART/RRT
- Estudos do terreno: levantamento topográfico, sondagem SPT do solo
- Canteiro: limpeza do terreno, tapume, barracão/ligação provisória de água e luz, locação da obra

**1. Fundação**

- Locação da obra (gabarito), escavação
- Formas, armação/ferragem, concretagem
- Tipos que mudam o quantitativo: radier, sapata isolada, sapata corrida, estaca, tubulão; baldrame (viga de fundação)

**2. Estrutura (superestrutura)**

- Pilares (vertical), vigas (horizontal), lajes
- Ciclo por elemento: forma > armação > concretagem > cura > desforma
- Tipo de laje muda tudo: pré-moldada, maciça, nervurada, steel deck, protendida

**3. Alvenaria / vedação**

- Marcação e elevação de paredes (bloco cerâmico ou concreto)
- Vergas (sobre portas/janelas) e contravergas (sob janelas)
- Distinção vedação vs estrutural

**4. Cobertura / telhado**

- Estrutura (madeira ou metálica), trama
- Telha (cerâmica, concreto, fibrocimento, metálica, shingle)
- Impermeabilização de laje (manta asfáltica ou membrana líquida), calhas/rufos

**5. Instalações (correm em paralelo, embutidas antes do revestimento)**

- Hidráulica: água fria (PVC marrom), água quente (CPVC/PPR), esgoto (PVC branco), pluvial
- Elétrica/dados: eletrodutos, fiação, quadro de distribuição, disjuntores, DR, DPS, aterramento
- (conforme obra: gás, ar-condicionado, incêndio, automação)

**6. Revestimentos**

- Parede interna: chapisco > emboço > reboco (espessuras típicas 5mm / 15-25mm / 5mm)
- Contrapiso: regularização da laje (3-5cm), caimento p/ ralos
- Assentamento de piso/parede (porcelanato, cerâmica, etc.)

**7. Acabamento**

- Gesso/forro (liso, drywall, PVC), sancas, nichos
- Esquadrias e portas (batente, folha, guarnição), vidros
- Louças e metais, bancadas, marcenaria/armários
- Pintura: preparação (massa corrida, lixamento) > tinta (látex PVA, acrílica, esmalte, epóxi)
- Escada (quando houver): NBR 9077, espelho 16-18cm, piso 28-32cm

**8. Entrega**

- Limpeza fina, testes de instalações, vistoria, habite-se, entrega das chaves

Achado de produto: as macroetapas são um **template default de ~8 grupos**; subetapas e tarefas são as
folhas editáveis. É exatamente a estrutura que o Pilar já tem em Projetos (escopo > disciplina >
tarefa), então Obra é a **mesma árvore com um template semente diferente**, não um modelo novo.

### 2. Quantitativo — o quão calculável é sem projeto completo

Muito calculável no nível de estimativa. Dois níveis:

**Nível A — pré-dimensionamento por m² de área construída (sem projeto, só área e padrão):**

- Concreto na superestrutura: **≈ 0,18 m³ por m² construído**
- Concreto em fundação rasa: **0,05-0,08 m³/m²**
- Aço: **70-100 kg por m³ de concreto** (índice global de superestrutura)
- Forma: **≈ 12 m² por m³ de concreto**
- Parede por m² construído (varia com padrão): casa popular 2,2-2,8; médio 1,8-2,2; alto padrão 1,2-1,8 m²/m²

**Nível B — consumo por unidade de serviço (TCPO/SINAPI, precisa de quantitativo do projeto):**

- Alvenaria: bloco cerâmico 9x19x39 em pé (parede 10cm) ≈ **23 un/m²**; deitado (20cm) ≈ 46 un/m²; bloco de concreto 9x19x39 ou 14x19x39 ≈ **12,5 un/m²**; tijolo comum ≈ 92 un/m² (10cm)
- Argamassa de assentamento: **18-25 litros/m²** de parede
- Argamassa de reboco: **≈ 20 litros/m²** (2cm) ou 16-20 kg por m² por cm de espessura
- Taxa de aço por elemento (kg/m³ de concreto): sapata ~60, radier ~70, laje maciça ~80, baldrame ~90, pilar ~110, viga ~110; pilar/fundação chegam a 100-160
- Cimento por m³ de concreto: ~6,5 sacos (50kg) no traço 1:1,5:3 (laje); ~8,4 sacos no 1:2:4 (pilar)

**TCPO** = Tabela de Composição de Preços para Orçamentos: para cada serviço (1 m² de parede, 1 m³ de
concreto, 1 m de tubo) dá o coeficiente de consumo de material, mão de obra e equipamento por unidade.
SINAPI é o análogo público (Caixa/IBGE). É a base para calcular tudo do Nível B.

Leitura: com **área + padrão + tipo estrutural** dá para gerar uma estimativa de material grosseira
(Nível A) sem projeto. Com o quantitativo de paredes/concreto do projeto, o consumo fino (Nível B) é
determinístico. **O gargalo não é a fórmula, é obter o quantitativo de área** (m² de parede, m³ de
concreto), que é justamente o que o takeoff tenta automatizar (ponto 5).

### 3. Campos de "perfil" que mudam etapas/quantitativo

Poucos parâmetros de cabeçalho reconfiguram o template e a estimativa:

- **Pavimentos (térrea vs sobrado):** sobrado adiciona escada, laje/piso do pavimento superior e
  **fundação reforçada** (mais aço/concreto na base) — são as três linhas de custo extra citadas
  consistentemente. Térrea = execução mais simples, menos etapas estruturais.
- **Área construída (m²):** escala linear da maioria dos insumos via índices/m².
- **Padrão de acabamento (popular/médio/alto):** muda relação parede/m² e todo o bloco de acabamento
  (louças, metais, revestimento). Base do CUB por padrão (R1, R8, etc.).
- **Tipo de fundação** (rasa vs profunda) e **tipo de laje/estrutura** (pré-moldada vs maciça, concreto
  vs metálica): mudam consumo e subetapas.
- **Itens opcionais que ligam etapas inteiras:** piscina, muro/contenção, cobertura metálica, subsolo.

Recomendação: modelar como **perfil da obra** (pavimentos, área, padrão, fundação, laje, opcionais) que
seleciona um template semente e pré-preenche estimativas, tudo editável.

### 4. Concorrentes de campo — o que é commodity e o que é diferencial

- **Sienge (Softplan, ERP, +2.300 clientes):** orçamento com **curva ABC de insumos**, BDI por serviço/
  família, cópia de orçamento entre obras, listas de insumo, planilha sintética/analítica; integra
  planejamento-orçamento-medição-contratos. É o pesado do mercado, vende para construtora.
- **Prevision Obras (Sienge):** planejamento com **IA** (cronograma com dependências/durações
  automáticas), Linha de Balanço + Gantt, **medição física via app no canteiro**, acompanhamento
  físico-financeiro, **curva S** (planejado vs real), diário de obra com análise de desvio por IA,
  consulta via WhatsApp, kanban de restrições. É o mais próximo do que "gestão de obra moderna" parece.
- **Mobuss Construção:** módulo de **Diário de Obra (RDO)** com painel de operações, timeline,
  **mapa de chuva**, histograma de mão de obra/equipamento, importação de RDO anterior, integração com
  Qualidade/Documentos/catraca virtual (crachá, QR, NFC). Forte em canteiro de construtora grande.
- **Obra Prima:** ERP para pequena/média construtora; RDO registra clima, tarefas concluídas, compras,
  horas, exporta PDF/e-mail ao cliente. Também publica curva ABC. Âncora de preço **a partir de
  R$399/mês** (nota anterior).
- **App Diário de Obra / RDO Digital:** RDO puro, web+mobile, **a partir de ~R$850/ano**.
- **Vobi:** foco no construtor/reforma com Vobi Pay; RDO e acompanhamento existem mas o moat é o
  financeiro/pagamento, não o campo (ver ANALISE_COMPETITIVA_VOBI).

**Padrão de mercado (commodity, todo mundo tem):** cronograma Gantt, RDO com clima/mão de obra/fotos,
medição física, curva S, curva ABC de orçamento. **Diferencial hoje:** IA no planejamento (Prevision),
integração financeira nativa (Vobi Pay, Sienge ERP), mapa de chuva no RDO (Mobuss).

Implicação para o Pilar: entrar em "gestão de obra" full compete de frente com Sienge/Prevision (IA +
ERP) e Mobuss (canteiro). O ângulo defensável não é replicar RDO/curva S, é **amarrar a obra ao mesmo
projeto onde já mora a margem** (o escritório toca a obra mas não fornece mão de obra), fechando o loop
projeto > execução > custo real por etapa que os ERPs de construtora não fazem para escritório de
engenharia.

### 5. Takeoff — extração de quantitativo por PDF/projeto

- **BIM/IFC (maduro):** modelo carrega os objetos, quantificação é automática e precisa. Ferramentas:
  Revit/Quantity Takeoff, Open BIM Quantities (mede a partir de IFC), addons OpenBIM no Blender exportando
  planilha. Problema para o ICP do Pilar: exige que exista modelo BIM, o que engenharia multidisciplinar
  de pequeno/médio porte no Brasil em geral **não produz**.
- **2D (DWG/PDF, imaturo):** AltoQi passou a importar DWG/PDF (2024) para criar objetos BIM sobre a
  planta 2D e quantificar. Ferramentas de IA (Togal.AI, Kreo 2D, Beam) detectam paredes, ambientes e
  aberturas de plantas: **Togal alega 98% em floor plan e ~80% do trabalho feito** com revisão humana;
  **Kreo reporta 85-92% em geometria simples** e engine de custo ainda fraco. Consenso: **transforma
  takeoff de uma semana em revisão de dois dias, mas sempre com QA humano**.

Leitura: extrair paredes/metragem de PDF arquitetônico automaticamente **é viável hoje só como
assistente com humano no loop**, não como número confiável cego. Para o Pilar, um takeoff automático é
um projeto de visão computacional caro e de acurácia parcial. **Alternativa barata e coerente com a
tese:** deixar o usuário informar área/padrão/pavimentos e usar os índices do ponto 2 para estimar
material, tratando extração de PDF como fase futura (ou parceria), não MVP.

### 6. APIs de clima para cruzar chuva x concretagem

- **Open-Meteo:** open-source, **grátis para uso não comercial, sem chave**, JSON horário até 7-16
  dias, resolução 1-11 km via modelos nacionais, cobertura BR pelo modelo global. Melhor custo-benefício
  para MVP. Uso comercial tem plano pago dedicado.
- **OpenWeather:** global, **1.000 chamadas/dia grátis** depois pay-as-you-go; One Call 3.0 tem
  **previsão de precipitação minuto a minuto (60 min)**. Bom, mas exige chave e vira custo em escala.
- **INMET:** órgão oficial brasileiro, dados e previsão pública; API/estações menos amigável para
  integração direta, útil como fonte oficial/histórico.
- **Climatempo:** API comercial BR (preço sob consulta), boa localização mas paga.

Recomendação: **Open-Meteo para o MVP** (chuva horária/diária cruzada com a data planejada de
concretagem, gerando alerta), com OpenWeather como fallback comercial se precisar de granularidade
minuto a minuto. Nota de memória do projeto: clima-API estava fora do MVP de Obras (spec 015) — este
achado confirma que dá para adicionar barato quando entrar.

## Frameworks / números

- Pré-dimensionamento (sem projeto): concreto 0,18 m³/m², fundação rasa 0,05-0,08 m³/m², aço 70-100
  kg/m³ de concreto, forma 12 m²/m³, parede 1,2-2,8 m²/m² por padrão.
- Taxa de aço por elemento (kg/m³): laje 60-80, viga/pilar 80-110 (até 160 em pilar/fundação).
- Consumo por serviço (TCPO): bloco cerâmico ~23 un/m² (10cm), bloco concreto ~12,5 un/m², reboco ~20
  L/m², assentamento 18-25 L/m².
- Preço-teto de RDO isolado no BR: ~R$850/ano. Gestão de obra leve BR: Obra Prima a partir de R$399/mês.
- Takeoff IA 2D: 85-98% de acurácia em geometria simples, ~80% do trabalho com revisão humana obrigatória.

## Citações

> "A TCPO mostra o coeficiente que é o fator de consumo de cada insumo para executar uma unidade de
> serviço ... 1 m² de parede, 1 m³ de concreto ou 1 m de tubulação." (diariodeobras.net)
> "Togal.AI claims 98% accuracy on floor plan takeoffs, and users report the AI completes roughly 80%
> of the takeoff work, with the estimator reviewing and correcting the rest." (appintent.com)
> "Open-Meteo provides high-resolution open data ranging from 1 to 11 kilometres ... free access for
> non-commercial use and no API key required." (open-meteo.com)

## Aplicação ao Pilar

- **Template semente de Obra = mesma árvore de Projetos** (escopo>disciplina>tarefa) com 8 macroetapas
  default. Não inventar modelo novo; herdar o existente. Confirma a decisão da spec 015 (obra = fase de
  execução do projeto, não entidade paralela).
- **Estimativa de material sem projeto é factível e barata** via índices/m² + perfil da obra (5-6
  campos). É um diferencial concreto contra "Gantt decorativo": entrega número desde o cadastro. Amarra à
  tese "saiba se o projeto dá lucro antes de terminar" — agora com custo previsto de material por etapa.
- **Não construir takeoff por PDF no MVP.** Maduro só em BIM/IFC (que o ICP não tem) e parcial/caro em
  2D. Substituir por entrada manual de perfil + índices; deixar extração como parceria/fase futura.
- **Não competir em RDO/curva S como feature de paridade** com Sienge/Prevision/Mobuss — eles têm IA e
  ERP. O ângulo do Pilar é o loop projeto>obra>custo real por etapa para o escritório que toca a obra sem
  fornecer mão de obra, um comprador que Sienge (construtora) e Vobi (construtor/reforma) não atendem bem.
- **Clima: Open-Meteo quando entrar** — barato, sem chave, resolve chuva x concretagem com um alerta.

## Relacionadas

[[research/aec/suprimento-estoque-e-frota-concorrentes.md]]
[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[research/aec/templates-por-vertical-onboarding-aec.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]

## Fontes

- Etapas: ldregulariza.com.br/blog/etapas-da-construcao ; construirsemerro.com.br ; mapadaobra.com.br ;
  avilaurbanismo.com.br ; portodueto.com (todas acessadas 2026-07-31)
- Quantitativos/TCPO: sienge.com.br/blog/como-calcular-material-de-construcao ; casaeobra.com ;
  diariodeobras.net/tcpo-o-que-e-e-como-usar-no-orcamento ; calculohub.com.br/calculadoras/aco-por-m3-de-concreto ;
  meusite.mackenzie.com.br/alfonso/magic.pdf (números mágicos) ; mestredeobra.app/PreDimensionamento.php
- Perfil térrea/sobrado: radio93fm.com.br/diferencas-entre-casa-terrea-e-sobrado ; setpar.com.br/blog
- Concorrentes: sienge.com.br/prevision-obras ; sienge.com.br/ebook-curva-abc ;
  mobussconstrucao.com.br/modulo/diario-de-obras ; blog.obraprima.eng.br ; diariodeobras.net/promocao
- Takeoff: appintent.com/software/construction/AI/Takeoff ; kreo.net/solutions/ai-construction-takeoff-sofware ;
  suporte.altoqi.com.br (importar DWG/PDF) ; multiplus.com/software/open-bim-quantities
- Clima: open-meteo.com ; openweathermap.org/api ; previsao.inmet.gov.br
  </content>
  </invoke>
