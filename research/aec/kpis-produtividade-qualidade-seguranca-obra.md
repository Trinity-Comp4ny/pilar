---
title: "KPIs de obra — produtividade (RUP/Hh), prazo/custo (IDP/IDC, PPC), qualidade (FVS/não-conformidade/retrabalho) e segurança (NR-18/NR-35, TF/TG); o painel que um gestor realmente olha"
source: "other" # blog Sienge/Prevision + fontes técnicas BR + normas ABNT/NR
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [vertical-saas, positioning, moat, metrics]
relevance_pilar: "high"
---

## TL;DR

Conhecimento de domínio sobre os indicadores de obra, filtrado pelo ICP do Pilar (escritório de
engenharia enxuto, não construtora com engenheiro de segurança dedicado). Quatro famílias: **produtividade**
(RUP = razão unitária de produção, em Hh por unidade de serviço; **menor é melhor**), **prazo/custo**
(IDP/IDC = SPI/CPI do EVM, coberto em profundidade na nota `controle-custos-medicao-e-valor-agregado.md`;
e PPC do Last Planner, a métrica de aderência ao planejado), **qualidade** (FVS, não-conformidade, retrabalho)
e **segurança** (NR-18 canteiro, NR-35 altura, taxas TF/TG da NBR 14280, DDS). A maioria desses KPIs é
**teatro de indicador para construtora grande**: exigem SESMT, apontamento de Hh no campo e volume de
repetição que o ICP não tem. Para um escritório enxuto que administra a obra sem fornecer mão de obra, o
painel real é curto: **custo real vs orçado por etapa, aderência de prazo (marco planejado vs entregue),
retrabalho/pendências abertas e um registro mínimo de segurança/qualidade que serve de prova documental**,
não de tableau de gestão de canteiro. Tudo isso já tem lar natural no RDO e no módulo Obra.

## Pontos-chave

### 1. Produtividade — RUP (Razão Unitária de Produção)

**Definição.** RUP = homem-hora gasto / quantidade de serviço executado. Unidade é **Hh por unidade
física** (Hh/m², Hh/m³, Hh/kg). É o indicador direto de produtividade de mão de obra. **Quanto menor a
RUP, mais produtiva a equipe.** Exemplo do Sienge: 800 Hh para 200 m² de alvenaria = **4,0 Hh/m²**; a meta
desejada citada era 2,5 Hh/m². (fonte primária Sienge, 2026)

**Homem-hora (Hh)** = 1 trabalhador × 1 hora. É a moeda de esforço. Uma equipe de 4 pedreiros por 8h = 32 Hh
no dia. A RUP transforma esse esforço em eficiência ao dividir pela produção física medida.

**Três RUPs (metodologia Souza/TCPO — profundidade sênior, além do blog):** a literatura de produtividade
brasileira (Ubiraci Souza) separa:
- **RUP diária (ou cíclica):** Hh do dia / produção do dia. Volátil, serve para detectar anomalia pontual
  (chuva, falta de material, retrabalho).
- **RUP cumulativa:** Hh acumulado / produção acumulada até a data. Estabiliza ao longo do serviço, é o
  número que se compara com orçamento/benchmark.
- **RUP potencial:** mediana das RUPs diárias abaixo da cumulativa, representa a produtividade "possível" em
  bom dia. Gap entre cumulativa e potencial = perda evitável.

**Curva de aprendizado.** Serviço repetitivo (laje de pavimento-tipo, alvenaria por andar) cai de RUP a cada
ciclo até estabilizar: efeito aprendizado. Por isso RUP do 1º pavimento é pior que a do 5º. Em obra com
poucos ciclos (casa térrea, reforma, obra única) **a curva mal se forma**, o que enfraquece a RUP como
ferramenta de gestão para o ICP do Pilar (ver Filtro de ICP).

**TCPO como baseline.** A TCPO/SINAPI dá coeficiente de Hh por unidade de serviço (ex.: X Hh de pedreiro +
Y Hh de servente por m² de alvenaria). É a RUP orçada. Medir RUP real no campo e comparar com a de TCPO é a
alça entre orçamento e execução. O gargalo não é a fórmula, é **apontar Hh por serviço no campo** (quem fez
o quê, por quanto tempo), que é caro e chato — a mesma dor que matou timesheet duas vezes no próprio Pilar.

### 2. Prazo e custo — IDP/IDC (SPI/CPI) e PPC

**IDP/IDC = SPI/CPI do EVM.** IDP (Índice de Desempenho de Prazo) = SPI = VA/VP; IDC (Índice de Desempenho de
Custo) = CPI = VA/CR. >1 é bom (adiantado/abaixo do custo), <1 é ruim. **Isto é EVM/valor agregado e está
coberto em profundidade na nota `controle-custos-medicao-e-valor-agregado.md` — aqui só o gancho.** O
acompanhamento físico-financeiro por curva S (planejado vs realizado) que Sienge/Prevision vendem é a
materialização visual do EVM.

**PPC (Percentual de Pacotes/Planos Concluídos) — a métrica de aderência do Last Planner.** PPC = pacotes de
trabalho **100% concluídos na semana** / pacotes planejados para a semana. Só conta o que terminou; 90% de um
pacote conta como 0. Mede **confiabilidade do planejamento de curto prazo**, não avanço físico. Estudo de caso
BR citado: implantação do Last Planner elevou PPC de 72% → 77% → 90% ao longo das fases, à medida que o
planejamento ficou mais assertivo. Referência de mercado: PPC saudável tende a **>80%**; abaixo disso o
planejamento semanal está sendo furado por restrições (material, projeto, mão de obra). Diferença crucial
para o IDP/EVM: **IDP diz se está no prazo do cronograma; PPC diz se a equipe cumpre o que promete semana a
semana** — é um leading indicator, o EVM é lagging.

**IRR / causas de não cumprimento.** O complemento do PPC no Last Planner é registrar **por que** cada pacote
não fechou (falta de material, projeto incompleto, clima, mão de obra, decisão pendente). Esse Pareto de
causas é onde mora a ação de gestão, mais do que o número do PPC em si.

### 3. Qualidade — FVS, não-conformidade, retrabalho

**FVS (Ficha de Verificação de Serviço).** Checklist de aceitação de um serviço executado (ex.: FVS de
alvenaria: prumo, esquadro, amarração, vergas/contravergas, limpeza). É o instrumento operacional do controle
de qualidade dentro do **PBQP-H** (Programa Brasileiro da Qualidade e Produtividade do Habitat) e alinhado à
**ISO 9001** de quem tem SGQ. Preenchida por etapa, com aprovado/reprovado por item; item reprovado gera
solicitação de retrabalho. Digitalizada, anexa foto/vídeo e amarra ao cronograma (proposta Sienge/Construpoint).

**Análogas:** **FVM** (Ficha de Verificação de Material, inspeção no recebimento) e **FVP/FVE** (projeto/
execução conforme a empresa). Para o ICP, o conceito relevante é o **checklist de aceite por etapa**.

**Indicadores de qualidade que saem da FVS:**
- **Índice de não-conformidade (NC):** itens reprovados / itens inspecionados. Tendência ao longo da obra.
- **Retrabalho:** custo (ou Hh, ou % do serviço) gasto refazendo o que foi reprovado. É o indicador que
  **fala a língua do dono da obra** (dinheiro jogado fora), diferente do NC que é técnico.
- **Índice de conformidade / aprovação de primeira** (first-pass yield): % de serviços aprovados sem
  retrabalho na 1ª inspeção.
- **Pendências abertas (punch list):** itens de qualidade a resolver, com prazo e responsável. Na entrega
  vira a lista de vistoria.

### 4. Segurança — NR-18, NR-35, TF/TG, DDS

**NR-18 (canteiro de obras).** Regulamenta condições e meio ambiente de trabalho na construção. Núcleo hoje:
**PGR** (Programa de Gerenciamento de Riscos — inventário de riscos + plano de ação; obra até 7 m e até 10
trabalhadores pode ter versão simplificada por profissional qualificado), **áreas de vivência** (sanitários,
refeitório, vestiário), proteções coletivas (guarda-corpo, plataformas), sinalização, ordem e limpeza.

**NR-35 (trabalho em altura).** Toda atividade **acima de 2 m** com risco de queda. Exige **treinamento
mínimo de 8h** (validade 2 anos), **APR** (Análise Preliminar de Risco) e, para atividades não rotineiras,
**PT** (Permissão de Trabalho). NR-18 e NR-35 se somam no canteiro; na sobreposição vale a mais restritiva.

**Indicadores de segurança (NBR 14280 — registro/estatística de acidentes):**
- **Taxa de Frequência (TF)** = (nº de acidentes × 1.000.000) / homem-horas de exposição. Acidentes por milhão
  de Hh trabalhadas.
- **Taxa de Gravidade (TG)** = (dias perdidos computados × 1.000.000) / homem-horas de exposição. Inclui dias
  debitados por incapacidade permanente/morte conforme tabela da norma. Parâmetro OIT citado: **≤500 muito
  bom, 500–1.000 bom, 1.000–2.000 ruim, >2.000 péssimo.**
- Ambos só fazem sentido com **volume de horas-homem** e histórico — métrica de empresa com muitos
  trabalhadores expostos, não de escritório com 3 pessoas no campo.

**DDS (Diálogo Diário de Segurança).** Conversa curta de segurança no início do turno. É registro de rotina,
não indicador numérico; o KPI associado é "% de DDS realizados / dias trabalhados". Barato de registrar e é
**prova documental** de que a segurança foi tratada.

### 5. O painel que um gestor realmente olha por semana

Ordenado pelo que puxa decisão, não pela sofisticação:
1. **Custo real vs orçado por etapa** (estou queimando margem?) — o número que o dono da obra cobra.
2. **Avanço físico vs planejado / curva S** e **desvio de prazo** (IDP) — vou entregar na data?
3. **Aderência do plano semanal (PPC)** + Pareto de causas de atraso — a equipe cumpre o combinado?
4. **Pendências e retrabalho abertos** (punch list, NCs) — o que trava a entrega/qualidade?
5. **Registro de segurança** (DDS feito, incidentes, alerta de altura) — mais compliance/prova que gestão.

Produtividade fina (RUP por serviço) e TF/TG **quase nunca entram no painel semanal do gestor de obra pequena**;
são análise de construtora com engenharia de produção e SESMT.

## Frameworks / números

- **RUP** = Hh / quantidade; menor = melhor. Ex. Sienge: 800 Hh / 200 m² = 4,0 Hh/m² (meta 2,5). Três RUPs:
  diária, cumulativa, potencial (metodologia Souza/TCPO). Baseline orçada = TCPO/SINAPI.
- **PPC** = pacotes 100% concluídos / planejados na semana; saudável >80%; caso BR 72%→77%→90% com Last Planner.
- **TF** = acidentes × 1.000.000 / Hh de exposição. **TG** = dias perdidos × 1.000.000 / Hh (NBR 14280);
  faixa OIT: ≤500 muito bom … >2.000 péssimo.
- **NR-35**: altura = acima de 2 m; treino 8h validade 2 anos; APR + PT. **NR-18**: PGR + áreas de vivência.
- **IDP/IDC = SPI/CPI** (>1 bom): profundidade na nota de EVM, não aqui.
- Qualidade: NC = reprovados/inspecionados; retrabalho em R$/Hh; first-pass yield; punch list. FVS sob PBQP-H.

## Citações

> "Quanto menor for o valor da RUP, maior será a produtividade da equipe." (sienge.com.br/blog/razao-unitaria-de-producao-rup)
> "Um PPC de 100% indica uma aderência perfeita ao planejado, enquanto valores menores apontam para a
> necessidade de ajustes na gestão ou na execução." (sienge.com.br/blog/ppc-planejamento-de-obras)
> "A NBR 14280 define a taxa de gravidade como o tempo computado por milhão de horas-homem de exposição ao
> risco em determinado período." (soc.com.br/blog-de-sst)
> "Considera-se trabalho em altura toda atividade executada acima de 2 metros do nível inferior, onde haja
> risco de queda." (NR-35, via praticolocacoes.com.br)

## Aplicação ao Pilar

**Filtro de ICP — o que o escritório enxuto de fato acompanha (3-5 KPIs) vs teatro de construtora grande.**

Mantém (cabe no ICP, alimentado pelo RDO/módulo Obra):
1. **Custo real vs orçado por etapa** — já é a tese do Pilar ("saiba se o projeto dá lucro antes de terminar")
   estendida à obra. Não é KPI novo, é a espinha. Amarra ao módulo Obra + conta da obra (spec 016/017/018) e
   ao motor de EVM leve descrito em `controle-custos-medicao-e-valor-agregado.md`.
2. **Aderência de prazo por marco** (marco planejado vs entregue) e curva S leve — barato porque o cronograma
   já existe em Projetos; é o IDP em versão de escritório, sem montar EVM completo.
3. **PPC semanal simplificado** — % de tarefas da semana concluídas + motivo do não cumprimento. Cai
   naturalmente no board de "Meu trabalho"/RDO: o RDO já pergunta o que foi feito; adicionar "planejado x
   feito da semana" é incremento pequeno com leitura de gestão real. **Mais valioso que RUP para este ICP.**
4. **Retrabalho / pendências abertas** — punch list por etapa com responsável e prazo. Fala a língua do dono
   da obra (dinheiro/prazo), não a do engenheiro de produção.
5. **Registro mínimo de segurança/qualidade como prova documental** — checklist de aceite por etapa (FVS
   enxuta) + registro de DDS/incidente no RDO. Valor é **auditabilidade e proteção jurídica** na obra por
   administração, não painel de TF/TG.

Corta (teatro de indicador para o ICP):
- **RUP por serviço** exige apontar Hh por atividade no campo — mesma fricção que matou timesheet no Pilar 2x
  e sem os ciclos repetitivos que dão curva de aprendizado. Só faz sentido em obra grande e repetitiva com
  engenharia de produção. **Não construir captura de Hh por serviço para calcular RUP.**
- **TF/TG (NBR 14280)** pressupõem volume de horas-homem e SESMT; para 3-5 pessoas no campo o número é ruído
  estatístico. Registrar incidente sim; calcular taxa por milhão de Hh, não.
- **PGR/APR/PT completos** são obrigação legal do responsável pela execução, mas **não são feature de KPI**;
  no máximo o Pilar guarda o documento por link (padrão "anexo = link externo", memória 2026-07-30).

**Posicionamento.** Sienge/Prevision/Mobuss vendem o pacote completo de indicadores (RUP, curva S, FVS
digital, mapa de chuva, catraca) para construtora com equipe de qualidade e segurança. Replicar isso é entrar
de paridade num terreno onde eles têm IA e ERP (ver nota de etapas). O ângulo defensável do Pilar é o mesmo de
sempre: **poucos números confiáveis amarrados ao projeto onde mora a margem** — custo real por etapa, prazo por
marco, PPC leve, retrabalho aberto — e o resto do RDO como prova documental da obra por administração, não como
tableau de canteiro. É o "número confiável > decoração de indicador" (memória Level-up).

**Implicação para o RDO.** O RDO já é o ponto de captura diário. Os 3 KPIs de ICP saem quase de graça dele:
avanço do dia (alimenta curva S/IDP), tarefas planejadas x feitas da semana (PPC), pendências/retrabalho e
registro de segurança (checklist + DDS). Não precisa de telas de KPI novas: precisa **derivar** esses números
do que o RDO já coleta e mostrá-los no painel da obra.

## Relacionadas

[[research/aec/controle-custos-medicao-e-valor-agregado.md]]
[[research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md]]
[[research/aec/obra-por-administracao-prestacao-de-contas-mercado-br.md]]
[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[research/aec/captura-rdo-por-voz-e-ia-gestao-obra.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]

## Fontes

- RUP/produtividade: sienge.com.br/blog/razao-unitaria-de-producao-rup (fonte primária, acessada 2026-08-11);
  globaltec.com.br/2017/04/18/medir-a-produtividade-da-mao-de-obra-na-construcao-civil ; metodologia das três
  RUPs (Ubiraci E. L. de Souza — base do TCPO de produtividade, conhecimento de domínio).
- PPC/Last Planner: sienge.com.br/blog/ppc-planejamento-de-obras ; prevision.com.br/blog/ppc-planejamento-de-obras ;
  repositorio.ifes.edu.br/handle/123456789/4502 (implantação Last Planner, PPC 72/77/90%) — acessadas 2026-08-11.
- Qualidade/FVS: sienge.com.br/blog/fvs-na-construcao-civil ; sienge.com.br/blog/digitalizacao-da-fvs ;
  sienge.com.br/blog/o-que-e-fvm ; PBQP-H (programa federal). Acessadas 2026-08-11.
- Segurança: soc.com.br/blog-de-sst/taxa-de-frequencia-e-gravidade (fórmulas TF/TG + faixa OIT) ;
  manualdaseguranca.com.br/nbr-14280 ; praticolocacoes.com.br (NR-18/NR-35 itens críticos) ;
  guiatrabalhista.com.br/legislacao/nr/nr18.htm ; ddsonline.com.br (DDS). Acessadas 2026-08-11.
- IDP/IDC = SPI/CPI: tratados em profundidade em research/aec/controle-custos-medicao-e-valor-agregado.md.
