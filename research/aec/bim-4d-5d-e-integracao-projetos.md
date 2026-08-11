---
title: "BIM no AEC — dimensões (3D/4D/5D/6D), IFC/openBIM, quantitativos 5D, mandato BIM BR (Decretos 10.306/11.888) e maturidade real no ICP"
source: "other" # Sienge, Autodesk/buildingSMART, ABDI/CBIC/FGV-IBRE, gov.br, papers ANTAC/USP
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, positioning, moat, onboarding]
relevance_pilar: "high"
---

## TL;DR

BIM é um **processo baseado em modelo de informação** (não um formato de desenho): cada elemento é
objeto paramétrico que carrega dado técnico, e as "dimensões" empilham camadas sobre a geometria 3D:
**4D = tempo** (cronograma amarrado ao elemento), **5D = custo** (quantitativo e orçamento extraídos do
modelo), **6D = sustentabilidade/ciclo de vida**, **7D = operação/FM**. O valor real para orçamento vem
do 5D, que **depende de ter 4D estruturado**, que depende de um 3D bem modelado. O padrão de
interoperabilidade é o **IFC (ISO 16739)** do buildingSMART, base do openBIM. No Brasil há **mandato
legal em obra pública federal** (Decreto 10.306/2020, atualizado pelo **Decreto 11.888/2024**), com
fases: projetos desde 2021, projetos+obras+orçamento+as-built em 2024, tudo (inclusive pós-obra) em
2028, mas **restrito a poucos órgãos federais** (Defesa/Infraestrutura), não a toda obra pública nem ao
setor privado. **Maturidade real: BIM está em ~20% das empresas de construção (mar/2024), concentrado em
escritórios de projeto/arquitetura e grandes players; o ICP do Pilar (engenharia multidisciplinar
pequeno/médio) em geral NÃO produz modelo federado IFC** — no máximo modela uma disciplina isolada.
**Confirma e reforça a premissa da nota de campo:** takeoff/BIM não é entrada de dado realista pro Pilar
hoje. **Veredito: tarpit para construir, oportunidade apenas na borda barata** (importar quantitativo já
exportado do modelo, via planilha).

## Pontos-chave

### 1. BIM x CAD — a diferença que importa pra orçamento

- **CAD (DWG/PDF):** desenho. Linhas e textos que *representam* uma parede. O software não "sabe" que
  aquilo é parede; quantidade só sai por medição manual ou por visão computacional (o takeoff 2D
  imaturo da nota anterior).
- **BIM:** banco de dados 3D. A parede é um **objeto paramétrico** com material, espessura, camadas,
  volume, área — atributos consultáveis. Quantitativo é uma *query*, não uma medição. É isso que torna
  o 5D possível: mudou o projeto, o quantitativo e o custo atualizam sozinhos.
- Implicação direta: a viabilidade de "extrair material do projeto automaticamente" **depende do formato
  de entrada**. Do BIM é determinístico; do CAD/PDF é heurístico e precisa de QA humano. O ICP entrega
  majoritariamente CAD/PDF.

### 2. Dimensões BIM (fonte: Sienge, "Dimensões do BIM")

- **3D — geometria + informação:** objeto paramétrico com especificação de material, dimensão, dado de
  fabricação. É a base; sem modelagem consistente, nada acima funciona.
- **4D — tempo:** cada elemento recebe referência ao cronograma de execução. Serve para *sequenciamento*
  e para enxergar conflito espaço-tempo (ex.: duas frentes que ocupariam o mesmo espaço na mesma semana).
- **5D — custo:** vincula custo ao modelo via **quantitativo automático + cronograma**. Permite ver
  orçamento sobre o 3D e comparar previsto x real. **Dependência dura: não há 5D sem 4D estruturado.**
- **6D — sustentabilidade/ciclo de vida:** consumo energético, durabilidade, manutenção preventiva,
  custo de ciclo de vida (comparar equipamento por custo total, não só compra).
- **7D — operação/FM:** as-built, histórico de manutenção, garantia, manuais — o modelo vira base do
  facilities management pós-entrega.
- Leitura: a cadeia **3D → 4D → 5D** é o que o mercado de orçamento persegue. Cada degrau exige o
  anterior maduro; por isso 5D "de verdade" é raro mesmo em quem tem 3D.

### 3. Interoperabilidade — IFC/openBIM e o atrito brasileiro de classificação

- **IFC (Industry Foundation Classes), ISO 16739:2018**, mantido pelo **buildingSMART**, é o padrão
  aberto de intercâmbio no AEC — a espinha do **openBIM** (fluxo colaborativo entre ferramentas de
  fornecedores diferentes: Revit, ArchiCAD, AltoQi, Blender+addons etc.).
- **Compatibilização / clash detection:** juntar os modelos das disciplinas (arquitetura, estrutural,
  hidráulica, elétrica) num modelo federado e detectar interferências (viga passando por duto) antes da
  obra. É um dos ganhos mais citados do BIM e exige que *várias* disciplinas estejam modeladas.
- **Atrito Brasil (fato relevante):** o sistema nacional de classificação, **ABNT NBR 15965** (Brasil é
  um dos poucos países com norma de classificação publicada), tem **estrutura diferente do SINAPI**, a
  base de orçamento de obra pública. Isso **dificulta a interoperabilidade modelo→orçamento**: mapear
  objeto IFC em composição SINAPI não é automático. Papers ANTAC/USP propõem fluxos openBIM+bSDD para
  fechar esse gap, o que sinaliza que **ainda é problema de pesquisa, não commodity resolvida**.

### 4. Quantitativo e orçamento a partir do modelo (5D) — e por que "não é milagre"

- Métodos de extração (Sienge, "Quantitativos em BIM"): (a) extração direta do objeto, (b) parâmetros de
  texto, (c) parâmetros calculados. Ferramenta demonstrada = **Revit** (schedules/tabelas por parâmetro).
- Alertas dos próprios especialistas: **"o software de modelagem não vai proporcionar milagres"**; evitar
  **overmodeling** (detalhe 3D que não serve ao orçamento); **alinhar a estrutura de modelagem à
  estrutura de composição de custo** (senão o quantitativo sai, mas não casa com o orçamento); começar
  por projetos pequenos. Ou seja: mesmo com BIM, 5D confiável exige **disciplina de processo e padrão**,
  não só ter o modelo.
- Ligação 4D↔5D: com quantitativo vindo do 3D e cronograma no 4D, o 5D dá **curva de custo no tempo** e
  previsto-x-real por período — exatamente a promessa que os ERPs de construtora (Sienge/Prevision) já
  vendem para quem *tem* o modelo.

### 5. Mandato BIM no Brasil — datas conferidas

Linha do tempo legal (fontes primárias/oficiais abaixo):

- **Decreto 9.983/2019** — instituiu a Estratégia Nacional de Disseminação do BIM (Estratégia BIM BR).
- **Decreto 10.306/2020** (02/04/2020) — estabeleceu a **obrigatoriedade do BIM em obras e serviços de
  engenharia da Administração Pública federal**, em fases.
- **Decreto 11.888/2024** (22/01/2024) — **nova Estratégia BIM BR**; revogou/atualizou dispositivos do
  anterior e ratificou os objetivos. É o marco vigente. *(assinado no atual governo; confirmar se alterou
  as datas das fases — as fontes secundárias mantêm o calendário 2021/2024/2028 — marcar como a checar em
  fonte primária do decreto se virar decisão.)*

Fases da obrigatoriedade (conforme fontes; **calendário a reconferir no texto do 11.888**):

- **Fase 1 — jan/2021:** BIM na **etapa de projetos**.
- **Fase 2 — 2024:** BIM em **projetos + obras** — inclui **orçamentação, planejamento e controle de
  execução**, além de modelagem **as-built**.
- **Fase 3 — 2028:** BIM em **todas as etapas**, incluindo **pós-obra/operação**.

**Escopo — leitura crítica (importante para o ICP):** o mandato é **federal e restrito** — as fontes
citam obrigação concentrada em poucos órgãos (**Ministério da Defesa e da Infraestrutura**), não em toda
obra pública. **Obra municipal/estadual e o setor privado não estão sob o decreto federal** (alguns
estados têm normas próprias — a checar caso a caso). Conclusão: o mandato **não força** o ICP do Pilar
(engenharia privada multidisciplinar) a produzir BIM. Ele cria pressão de mercado de médio prazo (quem
quer contrato público grande precisa), não uma exigência universal já em vigor.

### 6. Maturidade real de adoção — o teste da premissa do ICP

Números (separando fato de intenção):

- **~20,6% das empresas de construção usavam BIM em mar/2024** (vs 9,2% em mar/2018) — série FGV/IBRE.
  **Fato, e é o número mais sóbrio.** Crescimento real, mas ainda minoria.
- **CBIC: "79% já utilizam"** e **Mapeamento BIM Brasil: ~40% implementaram** — **estimativa enviesada**:
  são surveys de autosseleção (quem responde pesquisa de BIM tende a já usar BIM). Não representam o
  universo. Marcar como teto otimista, não base.
- **Sienge/Grant Thornton: 70% pretendem usar em até 2 anos** — **intenção, não uso**. Historicamente a
  intenção BIM supera a adoção por anos (custo de capacitação e ferramenta são as barreiras citadas para
  PME).
- **Concentração:** a adoção significativa está em **escritórios de projeto/arquitetura, indústria de
  componentes e grandes construtoras**. Barreiras explícitas para PME: **dificuldade de iniciar** e
  **necessidade de financiamento** (capacitação + licença Revit + processo).

Filtro de ICP (teste da premissa da nota `obra-etapas-quantitativos-e-ferramentas-campo.md`):

- **A premissa se mantém e sai reforçada.** O ICP do Pilar não é "escritório de arquitetura BIM-first";
  é engenharia multidisciplinar (civil/estrutural/MEP) de pequeno/médio porte. Nesse recorte:
  - **Estrutural e MEP** são as disciplinas onde modelagem 3D *aparece* com mais frequência (cálculo
    estrutural em TQS/Eberick já gera modelo; MEP em software próprio) — mas **modelo de disciplina
    isolada ≠ modelo federado IFC 5D**. Ter um modelo estrutural não dá quantitativo de obra inteira.
  - **Compatibilização/clash detection e 5D exigem modelo federado multidisciplinar** com padrão comum,
    que é justamente o que PME não sustenta (custo de processo, não de software).
  - Portanto: **assumir que o ICP entrega um IFC pronto pra sugar quantitativo é falso na maioria dos
    casos.** A entrada realista continua sendo **área/padrão/perfil da obra + índices** (Nível A/B da
    nota de campo), não o modelo.

## Frameworks / números

- Cadeia de dependência: **3D → 4D (tempo) → 5D (custo)**; não há 5D sem 4D estruturado.
- IFC = **ISO 16739:2018** (buildingSMART); openBIM = fluxo aberto multi-ferramenta.
- Classificação BR = **ABNT NBR 15965**, estrutura ≠ SINAPI → atrito modelo→orçamento (ainda em pesquisa).
- Mandato: **Decreto 10.306/2020 → Decreto 11.888/2024**; fases 2021 (projeto) / 2024 (projeto+obra+
  orçamento+as-built) / 2028 (tudo). Escopo restrito a poucos órgãos federais.
- Adoção **fato**: ~20,6% das construtoras (mar/2024). **Estimativa/intenção**: 40% "implementaram"
  (survey), 70% "pretendem em 2 anos", 79% "já usam" (survey autosselecionado) — não extrapolar ao ICP.

## Citações

> "A modelagem BIM 5D permite que os dados de custo e tempo sejam adicionados ao modelo." (Sienge)
> "O software de modelagem não vai proporcionar milagres." (Sienge, sobre extração de quantitativos)
> "A parcela de empresas de construção no Brasil que usam BIM atingiu 20,6% em março de 2024, ante
> 9,2% em março de 2018." (FGV/IBRE)

## Aplicação ao Pilar

Seja duro: **BIM é tarpit para o Pilar construir, e oportunidade só na borda mais barata.** Detalhe:

- **NÃO construir motor BIM/IFC, takeoff, nem 5D nativo.** Exige (a) que o cliente tenha modelo federado
  (a minoria do ICP não tem), (b) resolver o atrito NBR 15965↔SINAPI (problema de pesquisa aberto), (c)
  competir com quem já faz (Sienge 5D, Autodesk). É investimento alto de VC (visão computacional +
  parsing IFC + mapa de classificação) para atingir a fatia menos representativa do ICP. **Anos-luz fora
  de escopo e estágio.**

- **NÃO condicionar nenhuma feature de obra a "ter BIM".** O mandato federal não obriga o ICP privado, e
  a adoção real (~20%) está fora do nosso comprador típico. Desenhar Obra/orçamento pressupondo IFC =
  desenhar pra tela vazia. A entrada canônica continua **perfil da obra + índices/m²** (nota de campo).

- **A única borda que vale hoje: importar quantitativo já exportado do modelo, em planilha.** Quem *tem*
  BIM extrai quantitativo pra Excel/CSV de qualquer jeito. Um **importador de planilha de quantitativo**
  (colar/subir m² de parede, m³ de concreto, un por serviço) atende o cliente BIM **sem o Pilar tocar em
  IFC** e reaproveita o mesmo pipeline do import de extrato/fatura (spec 017) e do orçamento por índices.
  Custo baixo, risco baixo, cobre os dois mundos (com e sem modelo). É o "meet them where they are".

- **Posicionamento/venda:** não vender "BIM", não prometer 5D. Se surgir na conversa, a resposta honesta é
  "você exporta o quantitativo do seu modelo e o Pilar transforma em custo por etapa e margem" — amarra à
  tese "saiba se o projeto dá lucro antes de terminar" sem entrar na guerra de ferramenta de modelagem.

- **Radar (não agir agora):** a Fase 2/2028 do mandato e o avanço da NBR 15965/bSDD podem, em 3-5 anos,
  empurrar mais engenharia pública ao BIM. Se o ICP migrar para projeto público BIM-obrigatório, reabrir
  a discussão do importador IFC — como parceria/integração, não motor próprio. Gate de reabertura:
  **um cliente do ICP pedir, por escrito, para importar o modelo (não a planilha).**

## Relacionadas

[[research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md]]
[[research/aec/suprimento-estoque-e-frota-concorrentes.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]

## Fontes

- Dimensões/quantitativos/5D: sienge.com.br/blog/dimensoes-do-bim ; sienge.com.br/blog/quantitativos-em-bim ;
  sienge.com.br/blog/bim-4d-para-planejamento-e-controle ; sienge.com.br/blog/bim-5d ;
  blog.altoqi.com.br/bim/bim-5d ; orcafascio.com/papodeengenheiro/como-funciona-o-5d-no-processo-bim (acessadas 2026-08-11)
- IFC/openBIM/NBR 15965: buildingsmart.org.br ; blogs.autodesk.com/mundoaec/solucoes-bim-autodesk-e-interoperabilidade ;
  revistas.usp.br/gestaodeprojetos/article/view/226681 ; eventos.antac.org.br/index.php/entac/article/view/5760 (ISO 16739:2018)
- Mandato: Decreto 10.306/2020 e Decreto 11.888/2024 (gov.br/planalto) ; cbic.org.br/lula-assina-decreto-nova-estrategia-bim-br ;
  ff.solutions/panorama-de-leis-e-decretos-federais-para-o-bim-em-2024 ; migalhas.com.br/depeso/357946 (fases a reconferir no texto do 11.888)
- Adoção/maturidade: blogdoibre.fgv.br (20,6% mar/2024) ; cbic.org.br/pesquisa-sobre-bim-indica-que-79-das-empresas-ja-utilizam ;
  grantthornton.com.br/sala-de-imprensa/maturidade-bim-no-brasil ; cbic.org.br/programa-bim-na-pratica (todas acessadas 2026-08-11)
</content>
</invoke>
