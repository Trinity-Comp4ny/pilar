---
title: "UX de agentes de IA além do chat — padrões emergentes (2025-2026)"
source: "theme"
type: "theme"
url: "múltiplas — ver Citações/Fontes"
author: "accelerator-intel (síntese web 2025-2026)"
date_published: "2026-07"
date_captured: "2026-07-30"
tags: [ai-agents, ai-native, positioning, vertical-saas, onboarding]
relevance_pilar: high
---

## TL;DR

O consenso de 2025-2026 é que a interface de agente **não é um chatbot** — o chat é só um dos
modos. Os padrões que "sobrevivem ao teste de usuário" tratam a UI como **camada de governança e
confiança** entre a intenção do usuário e a ação autônoma: mostrar o que o agente está fazendo,
por quê, deixar sobrescrever a qualquer momento e recuperar de erro. Os sete padrões-chave:
(1) **generative/dynamic UI** (a resposta vira componente real, não texto), (2) **agent workspace/
canvas** (artefato editável ao lado da conversa), (3) **ambient agents** (rodam em background,
disparados por eventos, não por mensagem), (4) **agent inbox / HITL** (fila de aprovação estilo
e-mail), (5) **computer use / do-it-for-you** (o agente opera o sistema), (6) **streaming de
reasoning/working** (você vê o agente trabalhando: plano → passos → resultado), (7) **copiloto
lateral contextual vs. tela dedicada**. Para o ICP do Pilar (sócio de engenharia, avesso a firula),
o valor está em 1, 3, 4 e 6 ancorados no trabalho real; 5 (computer use) e canvas livre são
sobretudo "wow de demo" no estágio atual.

## Os 7 padrões (com produto real)

### 1. Generative UI / Dynamic UI — a resposta vira interface, não texto

O agente escolhe/gera **componentes reais** (formulário, tabela, gráfico, card, mapa, widget
multi-etapa) em vez de devolver um parágrafo. "LLM output → live, interactive UI." O texto puro
vira gargalo: esconde a execução, deixa o input vago e o processo opaco (a "black box"). Existe um
**espectro de controle**: (a) _estática_ — dev pré-define os componentes, o agente só escolhe qual
mostrar e preenche (ex.: card de clima); (b) _declarativa_ — o agente devolve JSON estruturado
(A2UI, MCP Apps) e o front pinta com o design system do produto; (c) _aberta_ — o agente devolve
HTML/iframe completo (flexível, mas risco de segurança e inconsistência visual).

- **Produtos:** Vercel v0, Claude Artifacts, ChatGPT Canvas, Bolt, Firebase Studio (geram UI).
  Protocolos: MCP Apps (Claude/ChatGPT/VS Code/Goose), Google A2UI, AG-UI (CopilotKit/assistant-ui).
- **Por que importa:** vira o "input estruturado" que substitui o formulário — o usuário conversa e
  o próprio agente monta o mini-formulário validado do que falta.

### 2. Agent workspace / canvas — artefato ao lado da conversa

Separa "conversa" de "trabalho": a esquerda é o diálogo, a direita é o **artefato vivo** (documento,
tabela, orçamento, código) que o agente edita e o usuário revisa/edita junto. "Multimodal handoff."

- **Produtos:** Claude Artifacts, ChatGPT Canvas, Cursor (diffs antes de aplicar), Notion AI.

### 3. Ambient agents — trabalham em background e te avisam

Definição de Harrison Chase (LangChain): agentes que **"escutam um stream de eventos e agem"**, não
disparados (só) por mensagem humana, e rodando **muitos em paralelo**. "Ambient não significa
totalmente autônomo." Latência relaxada permite planejar/refletir. Contraste direto com o chat, que
é 1-para-1 e força o humano a iniciar tudo.

- **Produto/ref:** LangChain ambient agents + LangGraph (persistência que "pausa" e espera humano);
  o exemplo canônico é um assistente de e-mail que triam a caixa sozinho e só chama você no que
  importa.

### 4. Agent inbox / human-in-the-loop — fila de aprovação estilo e-mail

UX **modelada em inbox de e-mail + ticket de suporte**: lista todas as "linhas abertas" entre você e
os agentes, com o que está pendente de decisão. Chase define 3-4 padrões de interação:
**notify** (avisa, sem agir), **question** (pergunta pra poder prosseguir), **review** (pede
aprovação antes de ação "perigosa", ex.: enviar e-mail) e **edit/time-travel** (editar a ação
sugerida ou voltar a um passo anterior). HITL "baixa o risco", constrói confiança e alimenta a
**memória/aprendizado** do agente.

- **Produtos:** LangChain Agent Inbox (open-source); Salesforce Agentforce (Observability: log de
  todo input/passo/ação/guardrail); Google Jules (pesquisa o repo, forma plano de 5 passos, **para
  e pede aprovação** antes de executar).
- **Nota Pilar:** é exatamente a aba **"Revisão"** que o Pilar já tem — só que hoje enterrada dentro
  de um chat, não elevada a superfície de primeira classe.

### 5. Computer use / do-it-for-you — o agente opera o sistema

O agente controla software como um humano (clica, digita, navega telas). Máximo de "faz por você",
mas hoje frágil/lento e opaco para o usuário leigo.

- **Produtos:** Claude Computer Use (Anthropic), OpenAI Operator, Google Jules (no código).

### 6. Streaming de reasoning/working — ver o agente trabalhando

Em vez de spinner, o produto mostra **plano → passos → resultado** em tempo real (plan-and-execute),
com "confidence signaling" e rationale em linguagem simples ao lado de cada ação. Transforma "caixa
preta" em sistema que revela seu estado — chave de confiança quando o usuário não é técnico.

- **Produtos:** Claude Code / Cursor (mostram o plano e o diff antes de aplicar); Perplexity (mostra
  as etapas de busca); Intercom Fin (mostra qual fonte/guia gerou a resposta — rastreável ao time);
  Linear (link "Why?" com o raciocínio da sugestão).

### 7. Copiloto lateral contextual vs. tela dedicada

Dois arranjos que convivem: **painel lateral** que aparece _dentro_ da tela em que você já está
(contexto local, sugestão não-intrusiva) e **tela/inbox dedicada** para o trabalho assíncrono em
lote. Regra emergente: copiloto lateral para ação pontual no contexto; inbox/workspace dedicado para
o fluxo de "muitos itens esperando sua decisão".

- **Produtos:** Figma (sugestões em painel lateral não-intrusivo), Notion AI, Gmail Smart features
  (lateral) vs. Agent Inbox (dedicado).

## Frameworks / números

- **Espectro de generative UI:** estática (alto controle do dev) → declarativa (controle
  compartilhado, JSON) → aberta (alta liberdade, HTML/iframe, risco). Fonte: CopilotKit/AG-UI.
- **3-4 padrões HITL (LangChain):** notify · question · review · (edit/time-travel).
- **Classificação de autonomia (autonomy slider/dial):** suggest-only → co-pilot → act-and-notify →
  autopilot, configurável **por tipo de tarefa** (não global). Ex.: Booking.com em 3 modos.
- **A interface é a "camada de accountability/governança"**: decide se as pessoas adotam ou
  abandonam o agente — não é enfeite.
- **Mercado:** Gartner projeta 40% das apps enterprise com agentes task-specific até fim de 2026
  (de <5% em 2025). Vertical AI com 2,3x mais ROI e 71% ainda gerando valor em 6 meses vs. 32% do
  horizontal-only (McKinsey State of AI 2025, citado 2ª mão — tratar com cautela).

## Citações

> "Text alone becomes a bottleneck." — CopilotKit, Developer's Guide to Generative UI (2026)
> "Ambient does not mean fully autonomous." — Harrison Chase, LangChain (Sequoia Training Data)
> "The interface is no longer the product. It is the governance layer that decides whether people
> adopt the agent or abandon it." — síntese Fuselab/Ascedia (agent UX 2026)
> Agent inbox = "some combination of an email inbox and a customer support ticketing system."
> — LangChain, Introducing Ambient Agents

## Aplicação ao Pilar

Contexto: o dono não gosta da cara de "chatbot"; ICP é sócio de engenharia, avesso a firula, quer
confiar no número e poupar tempo. Já existem 3 agentes de domínio + cards de confirmação + aba
"Revisão". A direção recomendada **não é jogar o chat fora** — é rebaixá-lo a input e promover o
trabalho a superfície.

**Faz sentido (ancorado no trabalho real):**

1. **Promover a aba "Revisão" a home dos agentes = "Agent Inbox do escritório".** É o padrão 4 (HITL)
   e o Pilar já tem o motor (`pending_review`). Vira "os agentes trabalharam, aqui está o que
   precisa da sua decisão": cada item com notify/question/review, valor em R$, e botão aprovar/editar.
   Isso É o "agentes trabalham para o escritório" sem chatbot — e casa com o diferencial de margem
   proativa do scan AEC ([[proactive-margin-agent-landscape]]).
2. **Generative UI no lugar de formulário (padrão 1).** Quando o agente precisa de dado, ele monta o
   mini-card validado só do que falta (ex.: "confirme o valor de honorário e a data-base") em vez de
   abrir um form gigante. Direto no "não quero preencher formulário, quero conversar e ver o
   trabalho".
3. **Streaming de working/reasoning simples (padrão 6), em português de engenheiro.** Não "chain of
   thought" cru: "Li os 12 projetos ativos → 2 fecham no vermelho → preparei os alertas". Constrói
   confiança no número, que é o job-to-be-done do sócio.
4. **Ambient de margem (padrão 3).** O agente varre projetos em background e empurra o alerta pro
   inbox sem ser chamado — exatamente o "nível 3" já mapeado como espaço aberto no AEC BR.

**Só gadget de demo (evitar agora):**

- **Computer use / do-it-for-you (padrão 5):** frágil, lento, opaco; o sócio não vai assistir um
  robô clicar telas. O Pilar controla o próprio banco via RPC — não precisa disso.
- **Canvas/generative UI aberta (HTML/iframe livre):** risco de segurança/inconsistência e zero valor
  pro ICP. Se usar generative UI, ficar na faixa **estática/declarativa** com o design system do
  Pilar (tokens), nunca HTML solto.
- **"Autonomy slider" com muitos níveis expostos ao usuário:** o sócio não quer configurar nível de
  autonomia por tarefa. Manter simples: sugere → você aprova (o card de confirmação atual). No
  máximo um toggle "avisar antes de agir" por tipo de ação sensível (dinheiro).

**Direção de UX recomendada (inovadora mas ancorada):**
"**Mesa de trabalho dos agentes**" em vez de chat. Layout: à esquerda, a **fila de trabalho** (o
agent inbox: alertas de margem, aditivos sugeridos, propostas a revisar, cada um com R$ e um verbo
de ação); ao abrir um item, um **painel de decisão** com o raciocínio destilado + o mini-card
(generative UI) pra confirmar/editar; a **conversa fica como um modo secundário** ("perguntar aos
agentes"), não a tela principal. Assim o produto comunica "os agentes já trabalharam" (não "digite
sua pergunta"), sem depender de nenhum gadget frágil e reaproveitando o motor `pending_review` que
já existe.

## Fontes

- LangChain — Introducing Ambient Agents: https://www.langchain.com/blog/introducing-ambient-agents
- LangChain Agent Inbox (repo): https://github.com/langchain-ai/agent-inbox
- Sequoia — Harrison Chase on Ambient Agents & Agent Inbox: https://sequoiacap.com/podcast/training-data-harrison-chase-2/
- CopilotKit — Developer's Guide to Generative UI in 2026: https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026
- Eleken — 6 Agentic UX Design Patterns With Real-World Examples: https://www.eleken.co/blog-posts/agentic-ux-examples
- Mantlr — Designing for AI Agents: 10 UX Patterns (2026): https://mantlr.com/blog/designing-for-ai-agents-ux-patterns-2026
- Fuselab — Agent UX: designing UI for AI agents in 2026: https://fuselabcreative.com/ui-design-for-ai-agents/
- Agentic Design — UI/UX & Human-AI Interaction patterns: https://agentic-design.ai/patterns/ui-ux-patterns
- The Interactive Studio — Beyond the Chat: Agentic Interfaces: https://insights.theinteractive.studio/beyond-the-chat-agentic-interfaces-inside-your-product

## Relacionadas

[[ai-agents]]
[[proactive-margin-agent-landscape]]
[[the-era-of-the-ai-agent]]
[[rise-of-vertical-ai-in-accounting]]
