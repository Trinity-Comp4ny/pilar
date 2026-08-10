---
title: "Obra Guru e Santo Concreto — scan competitivo p/ módulo Obra (voz→estrutura vs voz→predição)"
source: "other" # scan competitivo primário (sites dos concorrentes) + citação do design partner VRZ
type: "report"
url: "múltiplas — ver Citações"
author: "market-scout-aec"
date_published: "2026-07-31"
date_captured: "2026-07-31"
tags: [ai-agents, vertical-saas, positioning, moat, pricing]
relevance_pilar: "high"
---

## TL;DR

Os dois concorrentes que a VRZ citou vivem em ligas opostas. **Obra Guru** é um SaaS de canteiro
barato e productizado (R$49-199/mês) cujo diferencial de fato é **voz→RDO estruturado** (Gemini
transcreve o áudio do dia e preenche atividade/clima/equipe/equipamento), mas que **não** muta
cronograma nem financeiro. **Santo Concreto** não é software: é uma **gestora de obras** (mesmo
modelo de administração do ICP do Pilar/VRZ) que verticalizou numa ferramenta interna ("Sanco
Engenharia", ainda "EM BREVE" no site) e a apresenta com preço de ERP (~R$30k setup + R$3-4k/mês +
~R$1k/obra, per VRZ, não verificável publicamente). O feature "áudio→cronograma" que a VRZ ouviu é
pitch de ferramenta interna early-stage, sem prova pública. **A captura assistida por voz (voz que
ESTRUTURA o que o humano fala) é barata, replicável e defensável no Pilar; a predição de
quantitativo (que o CEO cortou) é o território caro e arriscado — e ninguém no BR está entregando
voz→atualização-de-cronograma-e-custo de forma madura ao ICP do Pilar.**

## Pontos-chave

### Obra Guru (obra.guru) — SaaS de canteiro, productizado

- **O que faz (commodity):** RDO estruturado (clima/equipe/equipamento/mídia), planejamento em
  Tabela/Kanban/Gantt na mesma tela, checklist de campo por ambiente com foto e offline, feed de
  pendências, financeiro (planejamento de compras, orçamentos comparativos, rastreio de pagamento),
  dashboard de atraso/progresso, fluxo de aprovação rascunho→revisão interna→aprovação do cliente.
- **Diferencial real:** **RDO por voz.** "Grave um áudio descrevendo o dia de obra. O Obraguru envia
  a transcrição para o Gemini, que extrai atividades, clima, equipe e equipamentos automaticamente."
  Ex.: "concretamos o bloco B, 12 m³, com bom tempo" → extrai betoneira, guindaste, 8 pedreiros, 2
  serventes, clima. Também: assistente **Insights** (linguagem natural: "quais obras estão atrasadas
  e o que fazer?", analisa RDOs+cronograma dos últimos 6 meses) e melhoria de texto.
- **Limite importante:** a voz **prioriza registro estruturado no RDO — NÃO atualiza diretamente
  cronograma nem financeiro.** É captura de diário, não reprogramação. Isso é exatamente o gap que o
  pitch da Santo Concreto promete cobrir (ver abaixo) e onde o Pilar pode se posicionar.
- **Público:** construtora, empresa de serviços E escritório de engenharia (declarado no site).
  Ampla, não focada — vantagem de alcance, desvantagem de foco no ICP.
- **Preço/modelo:** SaaS por obras ativas + créditos de IA. Starter R$49 (3 obras, 45 créditos),
  Growth R$99 (10 obras, 200), Pro R$199 (25 obras, 500), Enterprise sob medida. Trial 30 dias.
  Custo de crédito: RDO por voz 8 créditos, melhoria de texto 1, pergunta Insights 3. Gancho:
  "A obra inteira, no mesmo lugar" / "Menos planilha, mais automação".

### Santo Concreto (santoconcreto.com.br) — gestora de obras, NÃO software vendor

- **O que é:** gestora/gerenciadora de obras em Americana-SP (fundada por Matheus e Guilherme) que une
  "engenharia, compras, regularizações" para "gestão completa" e **gerencia via parceiros, sem mão de
  obra própria** ("a base de um bom trabalho está em unir forças com profissionais e empresas"). É o
  **mesmo modelo de negócio do ICP do Pilar e da própria VRZ**: administração/taxa sobre o custo.
- **A "tech":** desenvolveram "Sanco Engenharia", descrita como "solução inovadora que transforma a
  forma como os nossos projetos são gerenciados", com "total transparência e controle... acompanhamento
  em tempo real", acesso a cronograma/relatórios de progresso/atualizações de custo e interação com o
  time técnico. **No site a tecnologia está marcada como "EM BREVE"** — ou seja, ferramenta interna
  imatura/beta, não um produto público.
- **O feature de áudio (per VRZ, NÃO verificado):** o pitch relatado é entrada por áudio ("tô na obra
  tal, hoje tá rebocando, termina dia X") que **atualiza o cronograma, reprograma a quinzena, calcula
  quanto gastar a cada 15 dias e ajusta material.** Isso é voz→mutação de cronograma+custo, um degrau
  acima do Obra Guru (voz→RDO). Não há prova pública disso: nenhum resultado de busca, matéria de
  construtechs (Revista O Empreiteiro cita Construct IN, Conaz, Tractian etc., não a Santo Concreto),
  nem a página /tech confirmam. Tratar como **claim de vendas de ferramenta interna early-stage.**
- **Preço/modelo (per VRZ, estimativa de terceiro):** ~R$30 mil de setup + R$3-4 mil/mês + ~R$1 mil
  por obra. É preço de ERP/implantação, ~15-60x o Obra Guru. Coerente com "gestora vendendo a própria
  ferramenta como consultoria+software", não com SaaS self-serve.

## Frameworks / números

- **Eixo de captura por voz (novo, específico deste scan):**
  (0) transcrição pura → (1) **voz→registro estruturado** (Obra Guru: preenche campos do RDO) →
  (2) **voz→mutação de plano** (Santo Concreto claim: reprograma cronograma + recalcula custo da
  quinzena + ajusta material) → (3) **voz→predição** (contar paredes/quantitativo por PDF — o que o
  CEO do Pilar CORTOU por passivo de responsabilidade técnica).
  O nível 1 é commodity emergente no BR (Obra Guru, e via WhatsApp: Meu Construtor, Prevision). O
  nível 2 é onde há espaço e ninguém entrega maduro ao ICP do Pilar. O nível 3 é o território caro/
  arriscado que o Pilar deliberadamente evita.
- **Diferença crítica captura vs predição:** nível 1-2 = o humano AFIRMA o fato ("termina dia X",
  "hoje rebocou"), a IA só transcreve e roteia para o campo/plano certo. A responsabilidade técnica
  segue sendo do engenheiro que falou. Nível 3 = a IA AFIRMA um fato que o humano não disse (quantos
  m² de parede há na planta) e vira passivo técnico. **Captura assistida herda a responsabilidade do
  falante; predição cria responsabilidade nova.** Por isso o nível 1-2 é barato de operar (só custo de
  token de transcrição + parsing) e defensável, e o nível 3 não é.
- **Preços comparados:** Obra Guru R$49-199/mês self-serve · Santo Concreto ~R$3-4k/mês + R$30k setup
  - R$1k/obra (implantação). Duas ligas: SaaS SMB vs consultoria+ERP.

## Citações

> "Grave um áudio descrevendo o dia de obra. O Obraguru envia a transcrição para o Gemini, que extrai
> atividades, clima, equipe e equipamentos automaticamente." — obra.guru (site, 2026-07-31)
> "[a voz] prioriza registros estruturados no RDO, não atualizando diretamente cronograma ou
> financeiro." — leitura do site Obra Guru (2026-07-31)
> "uma solução inovadora que transforma a forma como os nossos projetos são gerenciados... total
> transparência e controle, permitindo o acompanhamento em tempo real" [tech marcada "EM BREVE"]
> — santoconcreto.com.br/tech (2026-07-31)
> "a base de um bom trabalho está em unir forças com profissionais e empresas" [gerencia via parceiros,
> > sem mão de obra própria] — santoconcreto.com.br/sobre (2026-07-31)

## Aplicação ao Pilar

**Commodity vs diferencial (para NÃO reconstruir o que já é barato/copiável):**

- Commodity no vertical: RDO estruturado, Gantt/Kanban, checklist de campo, financeiro de compras,
  aprovação com cliente, dashboard de atraso. Tudo isso o Obra Guru entrega por R$49-199. O módulo
  Obra do Pilar (spec 015 / ADR 0011: RDO + frentes + timeline, web-first) está no território
  commodity — o que é correto para o MVP, mas NÃO é diferencial defensável por si.
- Diferencial de fato que o Pilar pode reivindicar: amarrar a Obra à **margem por projeto** (a tese
  do Pilar), não ao canteiro. Obra Guru e Santo Concreto são obra-cêntricos (progresso físico/diário);
  nenhum liga a execução da obra ao "esse projeto vai fechar no lucro?". Esse é o mesmo espaço aberto
  já mapeado em proactive-margin-agent-landscape.md.

**Voz: replicar o nível 2, barato e honesto.**

- **Recomendação:** a captura assistida por voz (nível 1-2) é barata, replicável e defensável — e vale
  a pena para o Pilar, na dose certa. Custo real = transcrição (Whisper/Gemini) + parsing para JSON
  estruturado, coisa de créditos, sem infra pesada. O Obra Guru já provou o valor no BR (voz→RDO).
- O degrau que ninguém entrega maduro ao ICP do Pilar é **voz→atualização do que o Pilar já tem de
  bom: a frente/tarefa da obra e a projeção de custo/margem.** Ex.: engenheiro manda áudio "frente de
  reboco terminou, próxima é contrapiso, começa segunda" → Pilar reprograma a timeline da frente e
  atualiza a curva de desembolso da quinzena. Isso é o pitch da Santo Concreto, mas (a) sem preço de
  ERP e (b) amarrado à margem, não só ao cronograma. É captura, não predição: o engenheiro afirma o
  fato, a IA só estrutura — sem o passivo técnico que o CEO cortou.
- **Guardrail de responsabilidade:** manter o nível ≤2. A voz NUNCA deve inferir quantitativo ("a IA
  contou 40 m² de parede"); só deve estruturar o que a pessoa disse ("você disse que terminou o
  reboco"). Todo registro por voz entra como **rascunho editável com confirmação humana** (mesmo
  padrão HITL da mesa de agentes, spec 007), preservando a autoria técnica do engenheiro.

**Leitura estratégica dos dois concorrentes:**

- **Obra Guru = ameaça de commodity barato.** Se o módulo Obra do Pilar for só RDO+Gantt+financeiro de
  canteiro, o Obra Guru faz por R$99 e com voz. O Pilar não deve competir nesse eixo; deve usar a Obra
  como sensor que alimenta a margem por projeto (onde o Obra Guru não joga).
- **Santo Concreto = espelho do ICP, não concorrente de software.** É uma gestora igual à VRZ que
  tentou virar produto e cobra como consultoria. Sinaliza duas coisas: (1) o ICP do Pilar (gestora por
  administração) SENTE tanta falta de ferramenta que está construindo a própria e pagando R$30k+ por
  ela — validação de dor e de willingness-to-pay; (2) o pitch voz→cronograma+quinzena+material ressoa
  nesse ICP. O Pilar pode entregar isso productizado e integrado à margem por uma fração do preço.
- **Não verificado, marcar como estimativa:** o feature de áudio e o preço da Santo Concreto vêm só do
  relato da VRZ; a tech está "EM BREVE" e não há fonte primária pública. Se for decisão de produto,
  pedir à VRZ o material/print da apresentação antes de tratar como fato.

## Relacionadas

[[research/aec/proactive-margin-agent-landscape.md]]
[[research/aec/obra-etapas-quantitativos-e-ferramentas-campo.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]
[[research/themes/ai-agents.md]]
