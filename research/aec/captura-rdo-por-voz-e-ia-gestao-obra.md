---
title: "Captura de RDO por voz e IA em gestão de obra — players internacionais SMB, tendência voz→estrutura vs IA-que-prevê, viabilidade para o módulo Obra do Pilar"
source: "other" # sites de fornecedores + YC + imprensa construtech + docs OpenAI
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-07-31"
date_captured: "2026-07-31"
tags: [ai-agents, ai-native, vertical-saas, moat, positioning, pricing]
relevance_pilar: "high"
---

## TL;DR

Captura de RDO por voz não é mais fronteira: **Raken faz voz→texto há anos**, e em 2025-26 surgiu a
geração voz→**estrutura** (Benetics AI nos EUA/Procore; ObraVox e Obraguru no Brasil). A economia é
trivial: **Whisper US$0,006/min (ou GPT-4o-mini-transcribe US$0,003/min) + uma chamada de LLM para
estruturar ≈ US$0,03-0,05 por relatório**. Ou seja, o Pilar consegue construir isso barato e rápido
sobre o RDO que a spec 015 já define, no padrão de edge function + human-in-the-loop que já existe.
**Mas voz→RDO isolado JÁ é commodity** (grátis no ObraVox, embutido no Procore, padrão no Raken). O
diferencial não é a transcrição, é o **destino do dado estruturado**: no Pilar o RDO cai no mesmo
projeto onde mora a margem (etapa → avanço físico → custo real vs planejado), loop que os apps de RDO
avulso não têm e que Sienge/Procore têm mas não para o ICP (escritório que toca a obra sem fornecer mão
de obra). Distinção crítica que sustenta a decisão do CEO: **IA-que-transcreve** (humano fala o fato, IA
só organiza em campos, baixo passivo) é segura e é o gancho certo; **IA-que-prevê** (takeoff/quantitativo
por PDF, orçamento gerado) carrega passivo de responsabilidade técnica (ART) e foi cortada com razão.

## Pontos-chave

### 1. Players internacionais para pequeno/médio (não enterprise-only)

Preços em US$/mês, base 2026. Confiança: preços de agregador/imprensa marcados como estimativa; ponto de
partida de site oficial marcado como primário.

| Player                                | Preço (US$)                                                           | Público                                            | RDO/daily log                                      | IA / voz                                                       |
| ------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| **Contractor Foreman**                | ~$49/mês (anual, usuários ilimitados); tiers ~$132-415/mês trimestral | GC/empreiteiro pequeno, muito sensível a preço     | Sim (daily logs + timecards)                       | Sem voz/IA de destaque                                         |
| **Buildertrend** (fundiu CoConstruct) | promo ~$199 → real ~$399-799/mês; Essential ~$399-499                 | Construtor residencial / remodelador (custom home) | Sim (daily log com foto + clima) + client portal   | IA pontual; sem voz→estrutura de destaque                      |
| **CoConstruct**                       | ~$299+/mês (agora alinhado ao Buildertrend)                           | Custom builder/remodelador                         | Sim                                                | Idem Buildertrend                                              |
| **Fieldwire**                         | de $39/usuário/mês + tier grátis                                      | Campo / subempreiteiro de especialidade            | Task/plan viewing forte; **sem financeiro**        | Sem voz/IA de destaque                                         |
| **Raken**                             | ~$15/$37/$46 por usuário/mês (agregadores divergem; oficial é quote)  | GC comercial, foco em daily report                 | **Núcleo do produto** (weather/labor/equip/safety) | **Voz→texto em todo plano pago (maduro, commodity de ditado)** |
| **Knowify**                           | ~$186/mês                                                             | Empreiteiro com job costing + faturamento AIA      | Fraco em campo (precisa 2ª ferramenta)             | Sem voz/IA de destaque                                         |
| **Archdesk**                          | de £690/mês (~US$875)                                                 | Médio, end-to-end (estimativa→CVR→procurement)     | Sim, dentro do end-to-end                          | Conteúdo de IA em scheduling (marketing)                       |
| **Novade**                            | sob consulta                                                          | Enterprise field ops / QHSE (forte APAC)           | Checklists/quality/timecards/Gantt                 | Field ops, sem voz→RDO de destaque                             |

Leitura: a faixa SMB real fica em **US$40-500/mês**; o ICP de "gestão de obra leve" é atacado por preço
(Fieldwire/Contractor Foreman/Raken baratos) ou por profundidade financeira (Knowify/Archdesk). Nenhum
desses atende o **escritório de engenharia que fiscaliza/toca a obra sem ser a construtora**, que é o
vão do Pilar.

### 2. Tendência de IA/voz em gestão de obra: o que é maduro vs promessa

**Maduro / já em produção (2025-26):**

- **Voz→texto (ditado):** Raken há anos. Commodity.
- **Voz→estrutura (fala vira campos + metadados):** **Benetics AI** é o caso mais limpo — assistente de
  voz que gera Punch List, RFI e daily log falando; 30+ idiomas via OpenAI; integração Procore;
  apresentado no Procore Groundbreak 2025. No Brasil: **ObraVox** (Obra Prima; voz→RDO em PDF, grátis,
  "sem assinatura"), **Obraguru** (voz/texto→campos estruturados via Gemini, com "créditos de IA" nos
  planos), **Prumo**. Ou seja: **voz→RDO já está comoditizando no BR**, de graça inclusive.
- **Foto→insight:** Procore Assist (photo intelligence resume progresso/segurança).
- **Assistente conversacional sobre docs:** Procore Copilot/Assist (specs, RFIs, códigos).

**Emergente / promessa parcial:**

- **Agente que reprograma cronograma:** Procore Helix (schedule agent que sinaliza atraso e notifica
  contratado sem prompt), **Outbuild** (agent-powered scheduling, lançamento Q2 2026), **ALICE
  Technologies** (otimização/replanejamento dinâmico, critical path, "Insights Agent"). Padrão do bom
  design aqui é **sugerir e pedir aprovação humana antes de mover o cronograma**, não mover sozinho.
- **IA-que-prevê custo/quantitativo (takeoff por PDF):** **PLAN0 AI**, **Rudus** (concreteiros,
  detecta elementos estruturais na planta, -70% no tempo de estimativa), **Foreman** (planta→takeoff→
  proposta), Togal/Kreo. Acurácia 85-98% em geometria simples **sempre com QA humano obrigatório**.

**Quem faz bem:** Benetics (voz→estrutura pura, multilíngue, plugado no system of record alheio);
Procore (embute tudo: voz, foto, agentes, Agent Builder que gera daily log) mas é enterprise e caro;
no BR, Obraguru é o que mais se parece com "voz→RDO estruturado com fluxo de aprovação do cliente".

### 3. A distinção que sustenta a decisão do CEO: transcreve vs prevê

- **IA-que-PREVÊ** (takeoff/quantitativo por PDF, orçamento gerado): a IA **inventa números** (m² de
  parede, m³ de concreto, preço). Se erra, o erro entra num orçamento que leva ART/assinatura de
  responsável técnico → **passivo de responsabilidade profissional**. Por isso exige QA humano e por
  isso o CEO cortou. Decisão correta para o estágio.
- **IA-que-TRANSCREVE/ESTRUTURA** (voz→RDO/cronograma): o **humano é a fonte da verdade** ("hoje
  concretei o pilar P3, 4 pedreiros, choveu à tarde"); a IA é estenógrafa que joga isso nos campos que
  já existem. Não inventa quantidade, não assina nada. **Passivo baixo.** É exatamente o gancho seguro,
  e é o que ObraVox/Obraguru/Benetics exploram.

Regra de produto derivada: a IA do Pilar em Obra **pode organizar o que o humano disse e pode sinalizar
desvio** (isto atrasou, isto passou do custo), mas **não deve gerar número que vira compromisso técnico**
sem o humano no loop. Transcrever/estruturar/alertar: sim. Estimar/orçar sozinho: não (ou só como
rascunho revisável, nunca cego).

### 4. Viabilidade e custo para o Pilar

**Custo de operação (primário, docs OpenAI):**

- Transcrição: Whisper **US$0,006/min**; GPT-4o-mini-transcribe **US$0,003/min**.
- RDO falado típico 3-5 min ≈ **US$0,01-0,03** de transcrição.
- Estruturação: 1 chamada GPT-4o-mini com Structured Outputs (JSON schema = os campos do RDO que a spec
  015 já tem) ≈ poucos milhares de tokens = **< US$0,01**.
- **Total ≈ US$0,03-0,05 por RDO.** Irrelevante no COGS.

**Custo de construção:** o módulo Obra (spec 015) já modela RDO + frentes + timeline. Adicionar voz é
**captura de áudio no mobile/web + 1 edge function** (áudio → Whisper → GPT-4o-mini com JSON schema do
RDO → devolve rascunho preenchido → usuário confirma/edita). Cai no padrão `_shared/cors` + rate limit
por empresa que já existe, e no HITL da "mesa de trabalho dos agentes". **Dias, não meses.** Sem tabela
nova (grava no RDO existente).

**É diferencial ou commodity?**

- **Voz→RDO isolado = commodity.** Grátis no ObraVox, padrão no Raken, embutido no Procore, e no BR já
  tem 3+ players. Vender "RDO por voz" como headline seria vender paridade.
- **Diferencial = o destino do dado.** No Pilar o RDO estruturado atualiza o **avanço físico da etapa do
  projeto** e cruza com **custo/prazo planejado vs real** — fechando projeto→obra→margem para um ICP que
  os apps de RDO avulso (ObraVox/Obraguru) não servem (eles param no PDF pro cliente) e que
  Sienge/Procore servem só para construtora/enterprise. É o mesmo argumento da nota de etapas: o moat não
  é a feature de campo, é amarrá-la onde mora a margem.

## Frameworks / números

- SMB internacional: faixa US$40-500/mês; barato (Fieldwire $39/user, Contractor Foreman $49 ilimitado,
  Raken ~$15-46/user) vs profundo (Knowify $186, Archdesk ~$875).
- Voz→RDO custo unitário Pilar ≈ US$0,03-0,05/relatório (Whisper $0,006/min ou 4o-mini-transcribe
  $0,003/min + 4o-mini structuring < $0,01).
- Takeoff IA (bucket "prevê"): 85-98% acurácia geometria simples, QA humano obrigatório (passivo ART).
- BR voz→RDO já disponível: ObraVox (grátis), Obraguru (créditos de IA), Prumo.

## Citações

> "Benetics AI ... field teams create Punch List items, submit RFIs and log daily progress simply by
> speaking, with support for 30+ languages and Procore integration." (marketscale / businesswire, 2025-10)
> "Procore Agent Builder ... create custom AI agents ... from automating RFIs to generating daily logs."
> (procore.com/press, Groundbreak 2025)
> "Whisper costs $0.006/minute, ... GPT-4o Mini Transcribe costs $0.003/minute." (diyai.io, 2026)
> "ObraVox ... transforma áudio em um Relatório Diário de Obra completo ... Sem limites, sem assinatura."
> (blog.obraprima.eng.br/obra-vox)

## Aplicação ao Pilar

1. **Construir voz→RDO: sim, é barato e coerente com a tese** (humano fala, IA estrutura, humano
   confirma). Cabe em dias sobre a spec 015. Mas **posicionar como acelerador de captura, não como o
   herói** — é paridade, não wow.
2. **O herói é o loop:** "falo o andamento e o Pilar atualiza o avanço da etapa e me avisa se estourou
   custo/prazo do projeto". Isso é o que ObraVox/Obraguru não fazem e o ICP não tem em lugar nenhum.
3. **Não fazer IA-que-prevê no MVP** (takeoff/orçamento gerado). Mantém a decisão do CEO: passivo de ART.
   Estimativa de material fica no caminho barato dos índices/m² (nota de etapas), sempre editável.
4. **Reprogramação de cronograma por agente:** desejável, mas manter **HITL (sugere, humano aprova)**,
   nunca autônomo — é o padrão dos bons (ALICE/Outbuild/Helix pedem aprovação) e reduz passivo.
5. **Vigiar Benetics AI e Obraguru** como os que melhor executam voz→estrutura (internacional e BR).

## Relacionadas

[[research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md]]
[[research/aec/procore-peso-ux-e-pricing-2026.md]]
[[research/aec/monday-com-benchmark-2026.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]

## Fontes

- SMB pricing: downtobid.com/blog/buildertrend-pricing ; projul.com/blog/buildertrend-pricing-analysis-2026 ;
  contractortoolstack.com/software/contractor-foreman ; research.com/software/reviews/raken ;
  rakenapp.com/features/daily-reports ; capterra.com/p/159905/Archdesk ; softwareadvice.com/construction/novade-profile ;
  archdesk.com/fieldwire-alternative ; foreman.co/blog (todas acessadas 2026-07-31)
- IA/voz: marketscale.com (YC 2026 real estate/construction cohort) ; businesswire 20251013960059 (Benetics AI) ;
  procore.com/press/procore-launches-procore-ai ; procore.com/press (Groundbreak 2025 Helix) ;
  outbuild.com/q2-2026-launch ; alicetechnologies.com/construction-schedule-insights-agent
- BR voz→RDO: blog.obraprima.eng.br/obra-vox ; play.google.com (com.tec01.obravox) ; obra.guru/en/rdo ; useprumo.app
- Custo IA: diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026 ; parlaparla.io/blog/openai-whisper-cost-breakdown ;
  openai.com/index/introducing-structured-outputs-in-the-api
- "Santo Concreto" (santoconcreto.com.br): é empresa de engenharia/construção, NÃO o software voz→RDO —
  ver correção no resumo. Os players BR de voz→RDO são ObraVox, Obraguru e Prumo.
