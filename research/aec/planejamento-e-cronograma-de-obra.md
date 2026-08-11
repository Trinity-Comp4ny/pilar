---
title: "Planejamento e cronograma de obra — físico-financeiro, curva S, EAP/CPM, linha de balanço e Last Planner: o que cabe no ICP do Pilar e o que é peso de construtora"
source: "other" # blog Sienge (fonte primária de conceito BR) + Obra Prima/Senior + PMI/PMBOK + Lean/consultorias + acadêmico
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, positioning, moat, ai-agents]
relevance_pilar: "high"
---

## TL;DR

O vocabulário de planejamento de obra no Brasil é estável e público, e quase todo ele é **peso de
construtora/incorporadora** montado para sequenciar produção de múltiplas equipes no canteiro (CPM com
folga total/livre, linha de balanço para obra repetitiva, Last Planner colaborativo com subempreiteiros).
O único bloco que casa com o ICP do Pilar (escritório de engenharia que **administra/fiscaliza** a obra
sem fornecer mão de obra) é o **cronograma físico-financeiro + curva S**: a distribuição do avanço físico
no tempo casada com o desembolso, comparando **planejado vs real acumulado**. Isso É, quase ao pé da
letra, a tese "saber se o projeto dá lucro antes de terminar" desenhada num gráfico. A curva S é só a
**soma acumulada** de qualquer total (avanço físico, financeiro, homem-hora) plotada no tempo, forma de S
porque começa devagar, acelera no meio e desacelera no fim. A aderência se mede pelo **IDP/SPI** (índice
de desempenho de prazo, 0 a 1) e, no lado custo, pelo **IDC/CPI**, que são os índices do EVM
(gerenciamento de valor agregado / earned value). O caminho crítico, a linha de balanço e o Last Planner
completos NÃO devem ser copiados: são motor de scheduling de construtora (Sienge/Prevision/MS Project) e
competir por paridade ali é armadilha. O que o Pilar precisa é **poucos campos** (baseline por etapa,
peso %, avanço % medido, custo previsto vs real) que o RDO/medição já podem alimentar.

## Pontos-chave

### 1. Os três cronogramas (a distinção que importa)

Terminologia BR consolidada (Sienge, primário):

- **Cronograma físico:** atividades e prazos, sequência construtiva. Responde "o que e quando".
- **Cronograma financeiro:** fluxo de desembolso/custo ao longo do tempo. Responde "quando sai dinheiro".
- **Cronograma físico-financeiro:** funde os dois — avanço físico casado com o custo incorrido em cada
  etapa. É "o instrumento que combina o avanço físico com os custos incorridos". **Este é o único dos
  três que mede lucro em curso**, e é onde o Pilar joga.

Ele se apoia em **duas EAPs paralelas**: uma **EAP física** (fases > atividades gerenciáveis) e uma **EAP
orçamentária** (aloca R$ a cada componente). Na prática vira uma tabela: atividade em sequência lógica >
duração > valor total da atividade > % do orçamento total > custo distribuído por período. O
acompanhamento compara real vs planejado usando **EVM** (fonte: Sienge, post físico-financeiro,
08/05/2026).

### 2. Curva S — o gráfico da tese do Pilar

- **Definição exata (Sienge, 16/12/2024):** "a soma acumulada de parcelas de um total qualquer, podendo
  ser homem-hora, avanço físico, financeiro ou alocação de recursos", plotada no tempo. Nome vem da forma:
  pouco recurso no início, pico no meio, queda no fim.
- **Eixos:** vertical = % (ou quantidade) de trabalho concluído; horizontal = tempo.
- **Curva S física vs financeira:** a MESMA técnica sobre bases diferentes. Curva S **física** = %
  de avanço da obra acumulado. Curva S **financeira** = % do orçamento desembolsado acumulado. O poder
  está em **sobrepor as duas**: se o físico anda mais devagar que o financeiro, a obra está gastando mais
  rápido do que produz (sinal de estouro de custo). Fato de mercado, corroborado por múltiplas fontes BR.
- **Tabela canônica de 5 colunas:** (1) data de controle, (2) % planejado no período, (3) % planejado
  acumulado, (4) % executado no período, (5) % executado acumulado. Isso é literalmente o schema mínimo de
  uma curva S em software.
- **Aderência = IDP** (Índice de Desempenho de Prazo, 0 a 1; 1 = no prazo). É o **SPI do EVM**
  (SPI = EV/PV). Abaixo de 1 = atrasado. (Sienge; corroborado pelo PMBOK.)

### 3. EVM / valor agregado — o motor formal por trás do físico-financeiro

Vocabulário PMI/PMBOK (fonte independente global), que o Sienge cita como base do físico-financeiro:

- **PV** (Planned Value / Valor Planejado): custo orçado do trabalho **planejado** até a data.
- **EV** (Earned Value / Valor Agregado): custo orçado do trabalho **realmente executado** (= % avanço
  físico × orçamento da etapa). É o elo físico↔financeiro.
- **AC** (Actual Cost / Custo Real): o que **de fato** se gastou.
- **SPI = EV/PV** (= IDP): >1 adiantado, <1 atrasado. **CPI = EV/AC** (= IDC): >1 abaixo do custo, <1
  estourando. É exatamente "estou dando lucro?" em dois números.

Leitura: o EVM formal é enterprise, mas **o conceito EV = avanço% × orçamento é o cálculo que o Pilar
precisa** para transformar um RDO/medição de campo em "quanto de valor essa obra já entregou vs quanto
custou". Não precisa do aparato PMBOK inteiro; precisa de três números por etapa.

### 4. Horizontes de planejamento (longo / médio / curto)

Padrão consistente entre Sienge e Lean:

- **Longo prazo (plano mestre):** a obra inteira, macroetapas e marcos, pouco detalhe.
- **Médio prazo (lookahead, 2-6 semanas):** detalha a etapa que vem e **remove restrições** antes que a
  tarefa entre na semana.
- **Curto prazo (plano semanal):** só entram tarefas cujas restrições já foram eliminadas.

Isso vem do **Last Planner System** (ver ponto 6) mas o esqueleto longo/médio/curto é útil mesmo sem
adotar o LPS inteiro.

### 5. EAP/WBS, caminho crítico, folga e marcos (o motor de scheduling — peso de construtora)

- **EAP (WBS):** desmembra a obra em pacotes de trabalho menores. No Pilar isso **já existe** como
  escopo > disciplina > tarefa (projetos) e etapa > subetapa > tarefa (obra) — ver nota de etapas.
- **Dependências:** término-início (a mais comum), início-início, término-término. A relação que faz a
  tarefa B só começar quando A termina.
- **Marcos (milestones):** pontos de referência de duração zero (ex.: "fundação concluída", "habite-se").
- **CPM (caminho crítico, Sienge 17/06/2025):** a sequência de atividades que determina a data final.
  Calcula-se com **passada para frente** (ES/EF, datas cedo) e **passada para trás** (LS/LF, datas tarde);
  **folga total = LF − EF**; atividade **crítica = folga zero** (qualquer atraso empurra a entrega).
  **Folga total** = atraso possível sem mexer no fim do projeto; **folga livre** = atraso possível sem
  mexer no sucessor imediato.
- **PERT vs CPM:** PERT foca tempo/incerteza (durações probabilísticas otimista-provável-pessimista); CPM
  foca tempo + custo com durações determinísticas. Usados juntos em obra complexa.

**Alerta de ICP:** o motor CPM completo (rede, forward/backward pass, folga calculada) é o que MS
Project, Sienge e Prevision fazem. É valioso para quem sequencia dezenas de frentes/equipes. Para o
escritório que administra UMA obra, é over-engineering. Um Gantt com dependências simples e marcos basta;
calcular folga total/livre é raramente acionável nesse comprador.

### 6. Last Planner System / Lean Construction (colaborativo — peso de construtora)

- Criado por **Ballard & Howell (anos 1990)**. Premissa: quem executa (mestre, encarregado,
  subempreiteiro) sabe melhor o que dá para fazer, então **planeja de baixo para cima**.
- **Pull planning:** monta a sequência de trás pra frente a partir do marco final.
- **Análise de restrições:** identifica obstáculos (material, mão de obra, projeto, licença) e os remove
  ANTES da tarefa entrar na semana; acompanha pelo **Índice de Remoção de Restrições**.
- **PPC (Percent Plan Complete):** % de tarefas prometidas na semana que foram 100% concluídas =
  nº concluídas / nº prometidas. Métrica de **confiabilidade do planejamento**, com análise de causa-raiz
  do que falhou. Reuniões diárias de 15 min verificam execução vs plano.
- **Bandas de PPC (fonte consultoria, MARCAR COMO ESTIMATIVA/benchmark de mercado, não norma):**
  <50% obra fora de controle; 50-70% obra tradicional (muito desperdício); 70-85% Lean aplicado;
  >85% excelência. (Mensura Engenharia.)

**Alerta de ICP:** LPS é ferramenta de **gestão de produção no canteiro com múltiplas equipes/subs**. O
ICP do Pilar não fornece mão de obra nem gerencia subempreiteiros diretamente na maioria dos casos.
Adotar o LPS completo é peso de construtora. **O que dá para pegar emprestado:** o esqueleto de horizontes
(médio/curto) e a ideia de **restrição** (uma tarefa travada por pendência) — que casa com o modelo de
tarefa que o Pilar já tem, sem virar um sistema de produção.

### 7. Linha de balanço (LOB) — só para obra repetitiva (peso de construtora)

- **O que é:** técnica de prazo que põe os **locais repetitivos** (pavimentos, lotes, casas, trechos) no
  eixo Y e o **calendário** no eixo X; cada serviço vira uma linha inclinada cuja inclinação é o **ritmo**
  da equipe avançando de unidade em unidade. Linhas que se cruzam = **conflito** de equipes; mantém-se
  distância de segurança (**pulmão/buffer**).
- **Quando usa:** obra com repetição (edifício de N andares iguais, condomínio de casas, infra linear).
- **Vantagem:** enxerga cadência, reduz ociosidade e espera entre equipes, dá previsibilidade de ritmo.

**Alerta de ICP:** LOB só faz sentido em obra **repetitiva de escala** — território de incorporadora/
construtora (Minha Casa Minha Vida, prédios). O ICP de engenharia multidisciplinar civil/estrutural/MEP
raramente toca obra repetitiva grande. **Não priorizar LOB**; é o exemplo mais claro de feature que
impressiona em demo de construtora e é inútil pro comprador do Pilar. Sienge/Prevision já têm.

### 8. Baseline, replanejamento e aderência

- **Baseline (linha de base):** o cronograma físico-financeiro **congelado** no início, contra o qual se
  mede tudo. Sem baseline, "atraso" e "estouro" não têm referência.
- **Replanejamento:** quando a realidade desvia demais, recongela-se uma nova baseline (guardando o
  histórico). O erro comum é replanejar direto e perder a memória do desvio.
- **Aderência ao cronograma:** IDP/SPI e a distância entre a curva S planejada e a executada. É a leitura
  de saúde da obra num relance.

## Frameworks / números

- **Curva S = soma acumulada** (física, financeira ou homem-hora), forma de S; tabela mínima de 5 colunas
  (data, %plan período, %plan acum, %exec período, %exec acum). (Sienge, primário.)
- **EVM:** EV = %avanço × orçamento; SPI = EV/PV (=IDP, prazo); CPI = EV/AC (=IDC, custo); 1,0 = na meta.
  (PMBOK, global.)
- **CPM:** folga total = LF − EF; atividade crítica = folga 0; passada pra frente (ES/EF) e pra trás
  (LS/LF). (Sienge, 17/06/2025.)
- **Horizontes:** longo (plano mestre) / médio (lookahead 2-6 semanas, remove restrição) / curto (semanal,
  só tarefa liberada). (Sienge/LPS.)
- **PPC** = concluídas/prometidas na semana; bandas <50 / 50-70 / 70-85 / >85% (ESTIMATIVA de consultoria,
  não norma). LPS = Ballard & Howell, anos 1990.
- **LOB:** eixo Y locais repetitivos, eixo X tempo; inclinação = ritmo; cruzamento = conflito; buffer =
  pulmão. Só obra repetitiva.

## Citações

> "A fusão dessas duas vertentes resulta no cronograma físico-financeiro, um instrumento que combina o
> avanço físico com os custos incorridos." (sienge.com.br/blog/cronograma-fisico-financeiro, 08/05/2026)

> "[Curva S é] a soma acumulada de parcelas de um total qualquer, podendo ser homem-hora, avanço físico,
> financeiro ou alocação de recursos." (sienge.com.br/blog/curva-s, 16/12/2024)

> "Folga total é quanto tempo uma tarefa pode ser atrasada sem afetar a data de término do projeto. Folga
> livre é quanto tempo uma tarefa pode ser atrasada sem afetar nenhum sucessor imediato ... Atividades no
> caminho crítico possuem folga total igual a zero." (busca CPM, projectmanager/asana/Sienge)

> "[No Last Planner] só são indicadas as atividades cujas restrições já foram eliminadas." (busca LPS)

## Aplicação ao Pilar

**O que CABE no ICP (engenharia que administra a obra, não constrói):**

1. **Curva S financeira/físico-financeira LEVE é a materialização visual da tese.** "Saiba se o projeto dá
   lucro antes de terminar" = plotar avanço físico acumulado vs custo real acumulado vs baseline. É a
   feature de maior encaixe estratégico da nota inteira. Schema mínimo: por etapa da obra, guardar
   **peso % (baseline), avanço % medido, custo previsto e custo real**; derivar EV = avanço% × previsto e
   comparar com AC (real). Amarra direto ao módulo Obra (spec 015) e ao financeiro de dois bolsos.
2. **Marcos + baseline congelada por etapa**, não motor CPM. Poucos campos: data planejada, data real,
   status. Isso dá aderência ("estou atrasado nesta etapa") sem construir rede/folga.
3. **O avanço % vem da medição/RDO** — não pedir digitação dupla. O RDO por voz (nota captura-rdo) atualiza
   o avanço da etapa, que recalcula a curva S. Esse loop RDO→avanço→curva S→margem é o que os apps de RDO
   avulso (ObraVox/Obraguru) NÃO fecham e o que Sienge/Prevision só fazem pra construtora.
4. **Conceito de "restrição" emprestado do LPS, sem o LPS:** marcar uma tarefa como travada por pendência
   (material não cotado, projeto não liberado) já cria valor e conversa com cotações/estoque (specs 018/
   019), sem virar sistema de produção de canteiro.

**O que é PESO DE CONSTRUTORA — NÃO copiar:**

- **Motor CPM completo** (forward/backward pass, folga total/livre, rede PERT). Sienge/Prevision/MS
  Project já fazem; para quem administra uma obra é over-engineering. Máximo: Gantt com dependências
  término-início simples e marcos.
- **Linha de balanço (LOB).** Só serve a obra repetitiva de escala (incorporadora). Impressiona em demo de
  construtora, inútil pro comprador do Pilar. Descartar.
- **Last Planner System completo** (pull planning colaborativo com subs, análise formal de restrições, PPC
  semanal ritualizado). É gestão de produção no canteiro; o ICP não gerencia a mão de obra.
- **EVM formal com toda a nomenclatura PMBOK exposta ao usuário.** Usar o CÁLCULO (EV = avanço × orçamento)
  por baixo, mas mostrar em linguagem de dono: "previsto vs real", "no prazo/atrasado", não SPI/CPI.

**Posicionamento:** competir com Sienge/Prevision em "planejamento e cronograma" full é competir com IA +
ERP + décadas de scheduling. O ângulo defensável repete o das outras notas: **não é o Gantt, é a curva S
financeira amarrada ao projeto onde mora a margem**, para um comprador (escritório que toca a obra sem
fornecer mão de obra) que nem os ERPs de construtora nem os apps de RDO avulso atendem.

## Relacionadas

[[research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md]]
[[research/aec/captura-rdo-por-voz-e-ia-gestao-obra.md]]
[[research/aec/obra-por-administracao-prestacao-de-contas-mercado-br.md]]
[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]

## Fontes

- Sienge (fonte primária de conceito BR): sienge.com.br/blog/cronograma-de-obra ;
  sienge.com.br/blog/cronograma-fisico-financeiro (08/05/2026) ; sienge.com.br/blog/curva-s (16/12/2024,
  atual. 02/07/2026) ; sienge.com.br/blog/metodo-do-caminho-critico-cpm (17/06/2025) ;
  sienge.com.br/blog/last-planner-system ; sienge.com.br/blog/linha-de-balanco-o-que-e (todas 2026-08-11)
- Corroboração BR: blog.obraprima.eng.br/linha-de-balanco-obra ; senior.com.br/blog/linha-de-balanco ;
  mensuraengenharia.com.br/blog/last-planner-na-pratica.html (bandas de PPC = estimativa de consultoria) ;
  focoenobra.com (LPS) ; panorama.inco.vc/cronograma-fisico-financeiro-de-obras
- Global/normativo: PMI/PMBOK (CPM, folga total/livre, EVM: PV/EV/AC, SPI, CPI) via
  projectmanager.com/pt/metodo-do-caminho-critico ; asana.com/pt/resources/critical-path-method ;
  escritoriodeprojetos.com.br/metodo-do-caminho-critico (PMBOK 8)
- Acadêmico BR: periodicos.newsciencepubl.com/LEV/article/view/9021 (Lean/LPS/LDB em obra MCMV,
  Ferraz de Vasconcelos-SP) ; nppg.org.br (Boletim do Gerenciamento, linha de balanço)
- Todas acessadas em 2026-08-11.
