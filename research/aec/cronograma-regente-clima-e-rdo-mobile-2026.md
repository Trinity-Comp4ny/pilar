---
title: "Cronograma como regente + clima no cronograma + RDO mobile — como o mercado AEC trata (Sienge/Prevision, Procore, Autodesk ACC, Vobi, Mobuss, Sitedrive, Perryweather/Buildots) e o recorte do Pilar"
source: "other" # sites de fornecedores + docs de suporte + imprensa construtech
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-13"
date_captured: "2026-08-13"
tags: [positioning, icp, moat, vertical-saas, ai-agents, metrics]
relevance_pilar: "high"
---

## TL;DR

Três pedidos de design partner, três status de mercado distintos: (1) **cronograma regente com
RDO⇄avanço** — quase todos "puxam" o cronograma PARA o diário (Procore, ACC), mas o vínculo
INVERSO (reportar no RDO atualiza o % do cronograma sozinho) é **raro e mora em ferramentas de
planejamento**, não em apps de diário: Sienge/Prevision (registra avanço físico no app e alimenta o
físico-financeiro) e Sitedrive (marcar tarefa done atualiza PPC) são os casos mais próximos. É onde
o Pilar pode ganhar sendo simples. (2) **Clima no cronograma** — logar clima no RDO é commodity
(Procore, Vobi, ACC, todo app de RDO tem o campo), mas **clima que olha PREVISÃO e alerta a etapa
sensível ("vai chover, não concreta a laje, reprograme")** é raro e vive em nicho especializado
(Perryweather, UBIMET, Visual Crossing, Flash Weather AI), NÃO nos ERPs generalistas. É
diferenciação real, barata, e cabe no ICP. (3) **RDO mobile com foto** — commodity absoluta (Vobi,
Mobuss, Autodesk, Procore, ObraVox, Brickup, dezenas de apps grátis). Não é herói, é paridade.

## Pontos-chave

### 1. Cronograma "regente" com RDO⇄avanço: quase todos fazem meio caminho, poucos fecham o loop

Existem DOIS vínculos e o mercado quase sempre entrega só um:

- **Cronograma → RDO (puxar tarefa do dia pro diário):** commodity.
  - **Procore Daily Log — "Scheduled Work":** puxa dados ao vivo do cronograma importado e atualiza
    automático; mostra tarefas pré-agendadas ao lado do relatório. É one-way (o cronograma informa o
    log), o log não devolve % pro cronograma. Fonte primária: support.procore.com daily-log.
  - **Autodesk Construction Cloud (agora Forma Build):** daily reports por template, foto/vídeo/áudio
    no mobile, "track progress directly in sheets from mobile", workflow de review/approval com
    audit trail. Progresso vive em sheets, não realimenta um Gantt automaticamente.

- **RDO → cronograma (reportar avança o % do cronograma sozinho):** raro, e mora em PLANEJAMENTO.
  - **Sienge/Prevision (Starian/Softplan):** "registra avanço físico direto pelo app", integra
    **físico-financeiro**, compara planejado vs executado em tempo real, replaneja sem recriar o
    cronograma. É o caso BR mais próximo do "regente". Mas ICP = construtora/incorporadora
    média-grande (ver nota sienge-prevision).
  - **Sitedrive (Fira, Finlândia):** Gantt/Flowline/**Takt**; marcar tarefa in-progress/done
    **atualiza o PPC automaticamente** (Last Planner); sincroniza múltiplas visões de cronograma.
    É o design "regente" mais limpo, mas é ferramenta de planejamento Lean, não de margem.
  - **Buildots / Versatile:** fecham o loop por SENSOR (câmera de capacete / guindaste que pesa),
    não por digitação humana — "AI-based progress tracking automating schedule updates". Caro,
    enterprise, hardware.

Leitura: o "cronograma como regente que se atualiza pelo report" é **percebido como avançado**
justamente porque a maioria dos apps de campo NÃO fecha o loop inverso. Quem fecha é ERP de
construtora (Sienge) ou ferramenta Lean (Sitedrive) — nenhum servindo o escritório de engenharia
que fiscaliza/toca a obra sem ser a construtora.

### 2. Clima no cronograma: separar 3 níveis (o design partner está pedindo o nível 3)

- **Nível 1 — logar clima no RDO (commodity):** Vobi ("campo de condições climáticas por turno"),
  Procore (puxa clima da localização automático pro daily log), ACC, Buildertrend, todo app de RDO.
  Serve pra registro/prova de paralisação. Zero diferenciação.
- **Nível 2 — clima histórico p/ pleito de atraso (documentação):** Procore preserva log histórico
  pra "delay claim documentation". Útil, ainda commodity.
- **Nível 3 — PREVISÃO cruzada com etapa sensível + alerta proativo ("vai chover em 48h, laje de
  concreto empurra 2 dias, reprograme"):** **raro e especializado**, NÃO está nos ERPs generalistas.
  Players: **Perryweather, UBIMET (Construction Weather), Visual Crossing, Flash Weather AI
  (foco concreto), Cordulus, AEM**. Procore admitidamente **não** faz: "primarily a logging tool
  rather than monitoring/alerting, no proactive alerts when adverse weather is forecast, no schedule
  integration where weather data connects to scheduled activities" (ustechautomations 2026).
  Consenso do nicho: "schedule integration is the single most important feature in weather software".

Ou seja: o nível 3 é diferenciação real e é onde ninguém do ICP de engenharia está. É barato
(API de previsão + regra por tipo de etapa marcada como "sensível a chuva"). Risco: virar gimmick
se for alerta genérico de tempo; só vale se ligado à ETAPA e ao impacto de prazo/custo.

### 3. RDO mobile com foto: commodity absoluta

Vobi (foto + notas + clima + compartilha com cliente em tempo real, tablet/smartphone), Mobuss
(módulo diário web+mobile responsivo, importa de Qualidade/Portaria/GED, guia o preenchimento),
Autodesk (foto/vídeo/áudio no campo), Procore, e um mar de apps grátis BR (ObraVox, Brickup,
Diário de Obra Online, VIGHA, Fotogeo). "RDO mobile com foto" como headline = vender paridade.

## Frameworks / números

- Vínculo cronograma-RDO: one-way (puxar) = commodity; two-way (report avança %) = raro, só em
  planejamento (Sienge/Prevision, Sitedrive) ou por sensor (Buildots/Versatile).
- Clima: nível 1-2 (logar/histórico) = commodity; nível 3 (previsão→etapa sensível→alerta+reprog.)
  = raro, especializado (Perryweather/UBIMET/Visual Crossing/Flash Weather AI), fora dos ERPs.
- RDO mobile foto = commodity total (10+ players BR, vários grátis).
- Custo p/ Pilar do nível 3 de clima: 1 API de previsão (Open-Meteo grátis / OpenWeather) + regra
  por etapa marcada "sensível a chuva/vento" + alerta. Dias, não meses. Sem hardware.

## Citações

> "The Scheduled Work log pulls live data from the project's uploaded schedule and updates
> automatically." (support.procore.com, daily-log)
> "[Procore is] primarily a logging tool rather than a monitoring and alerting tool, with no
> proactive alerts when adverse weather is forecast and no schedule integration where weather data
> connects to scheduled activities." (ustechautomations.com, 2026)
> "[Sitedrive] allows you to set tasks to in-progress and done to update the progress levels (PPC)
> automatically." (sitedrive.com)
> "[Prevision] registra o avanço físico direto pelo app ... integra o cronograma físico-financeiro."
> (sienge.com.br/prevision-obras)
> "Schedule integration is the single most important feature in weather management software ... how
> rain on a scheduled concrete pour will push slab completion by 2 days." (ustechautomations, 2026)

## Aplicação ao Pilar

1. **Cronograma regente com RDO→avanço: SIM, é o vínculo que vale, e é onde dá pra ganhar sendo
   simples.** O mercado do ICP não tem. Mas manter o recorte da tese: no Pilar o avanço da etapa
   deve puxar **margem** (custo real vs planejado da etapa), não só um Gantt bonito. Copiar
   Gantt/Flowline/Takt do Sitedrive = território de construtora (armadilha já registrada em
   planejamento-e-cronograma e SÍNTESE). O regente do Pilar é **etapa → % → margem/prazo**, com
   HITL (report vira rascunho de avanço, humano confirma), não cronograma que se move sozinho.
2. **Clima nível 3: SIM, é a diferenciação mais barata e mais alinhada ao nicho.** Marcar etapas
   como "sensível a chuva/vento/temperatura" (concretagem, impermeabilização, pintura externa,
   içamento) e alertar com previsão + impacto de prazo. Ninguém no ICP faz. Ligar SEMPRE à etapa e
   ao efeito margem/prazo, nunca alerta de tempo solto (aí vira gimmick). Cuidado: não prometer
   reprogramação automática — sugerir e o humano decide (mesmo padrão HITL da nota RDO-por-voz).
3. **RDO mobile com foto: fazer, mas como captura, não como herói.** É paridade. O herói é o
   destino do dado (avanço da etapa + margem), igual ao argumento voz→RDO. Não competir em
   "app de campo bonito" com Vobi/Mobuss/Autodesk.
4. **Fronteira ICP vs ERP de construtora:** físico-financeiro/curva S/EVM completo, Last Planner,
   Takt, folha e insumo de canteiro = território Sienge/Procore, NÃO copiar. Cronograma leve com
   etapa→avanço→margem + clima na etapa sensível + RDO captura = reforça a tagline "saiba se cada
   projeto dá lucro antes de terminar" sem virar ERP.

## Relacionadas

[[research/aec/captura-rdo-por-voz-e-ia-gestao-obra.md]]
[[research/aec/planejamento-e-cronograma-de-obra.md]]
[[research/aec/sienge-prevision-intel-competitiva-e-conteudo.md]]
[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[research/aec/SINTESE-conhecimento-obra-para-decisao-produto.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]

## Fontes

- Cronograma⇄RDO: support.procore.com/products/online/user-guide/project-level/daily-log ;
  procore.com/quality-safety/daily-log ; construction.autodesk.com/tools/construction-daily-reports ;
  sienge.com.br/prevision-obras ; sienge.com.br/demonstracao-prevision ;
  sitedrive.com/software/construction-scheduling ; sitedrive.com/software/construction-progress-tracking ;
  buildots.com/blog/automate-schedule-updates (todas acessadas 2026-08-13)
- Clima: ustechautomations.com/resources/blog/construction-weather-delay-software-comparison-2026 ;
  perryweather.com/resources/construction-project-manager-scheduling ;
  ubimet.com/en/industries/construction-weather-forecasting-industry-solutions ;
  visualcrossing.com/resources/blog/weather-driven-construction-project-scheduling ;
  flashweather.ai/industries-we-serve/concrete ; support.procore.com (weather delay) (2026-08-13)
- RDO mobile: vobi.com.br/funcionalidades/diario-de-obra ; vobi.com.br/funcionalidades/aplicativo-para-celular ;
  mobussconstrucao.com.br/solucao/diario-de-obras ; mobussconstrucao.com.br/blog/modulo-diario-de-obra ;
  construction.autodesk.com/workflows/construction-project-management (2026-08-13)
