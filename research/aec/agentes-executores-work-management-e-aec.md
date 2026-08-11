---
title: "Agentes que EXECUTAM (não só sugerem): como Monday, ClickUp, Asana, Notion, Linear e a ConTech (Vobi) estruturam agentes executores, os padrões de design que se repetem e onde mora o diferencial para engenharia"
source: "other" # monday.com (blog/IR/press), ClickUp (help/press), Asana (IR/product), Notion, Linear/Cursor, Vobi (site/press), BuiltWorlds/Kreo/Beam (ConTech), sínteses de agent-UX
type: "report"
url: "múltiplas — ver Fontes"
author: "market-scout-aec"
date_published: "2026-08-11"
date_captured: "2026-08-11"
tags: [ai-agents, ai-native, vertical-saas, positioning, moat, agent-ux-patterns]
relevance_pilar: "high"
---

## TL;DR

O mercado de work management fez em 2025-2026 uma virada de narrativa de "IA que sugere/resume" para
"**IA que executa trabalho multi-etapa**", e todos convergiram para o mesmo modelo mental: o humano
**orquestra**, o agente **executa** ("You orchestrate, agents execute", monday). O agente vira um
**colaborador digital com função** (compras, financeiro, secretária), disparado por **evento** ou por
**pedido em linguagem natural**, que encadeia passos e devolve **resultado pronto para revisão**. No
vertical AEC isso já saiu do slide: a **Vobi** (concorrente BR direto) lançou em nov/2025 um **Agente
Financeiro** e um **Agente de Compras** que, via WhatsApp (foto/áudio/documento), executam o fluxo
solicitação → cotação → ordem de compra e geram lançamentos "prontos para revisão". Cético: a maior
parte do que os genéricos (monday/ClickUp/Asana/Notion) chamam de "agente executor" ainda é
**automação declarada em linguagem natural + read-and-synthesize**; a escrita/ação com consequência real
(gastar dinheiro, mexer em fornecedor) ou é limitada ao próprio ecossistema (Notion admite que "pode
achar um ticket no Jira mas não consegue mudar o status") ou fica atrás de aprovação humana. O
diferencial defensável do Pilar **não** é ter "um agente" (a Vobi já ganhou essa corrida de marketing),
é **onde o agente executa**: no lugar onde a margem mora (custo do projeto/obra por administração), com
o dado proprietário do escritório e a prestação de contas como saída, coisa que Monday/ClickUp nunca vão
fazer bem.

## Pontos-chave

### 1. Monday.com — "digital workforce" e a era da execução

Modelo mental explícito e citável: **"You orchestrate, agents execute"** — pessoas definem estratégia e
julgamento, agentes cuidam de "campaigns, reports, workflows, and content". A monday se reposicionou de
"Work OS" para **"AI Work Platform"** e batiza a fase de **"Work Execution Era"** / **"Agentic Era"**.

Como o trabalho é executado (o que dá para confirmar em fonte primária):

- **Agentes monitoram e agem por evento:** "By monitoring your boards, the agents will detect what needs
  attention and take action automatically." Reagem a mudanças via **webhooks em tempo real**, disparam
  automações e geram outputs estruturados.
- **Workflow por linguagem natural:** você descreve o processo inteiro uma vez em linguagem natural e a
  monday **gera o workflow** (ex.: extrair dados de empresa de um formulário → resumir requisitos →
  criar itens em vários boards → notificar). O sistema decompõe em **blocos** (trigger de formulário,
  bloco de extração, bloco de resumo, criar item, notificar) e os liga em sequência. Esse é o fluxo que
  aparece na home nova: **um pedido em linguagem natural → uma sequência de passos gerada e executada.**
- **Agentes nomeados / com papel:** **monday Expert** (assiste novos usuários, guia execução de tarefa,
  opera autonomamente) e **monday sidekick** (worker digital pessoal, contextual, que "proactively
  suggests and takes action"). Ou seja, a metáfora é **agente-como-colega com função**, não um genérico.
- **Governança por permissão, não por aprovação passo-a-passo:** o material primário enfatiza "full
  visibility, clear permissions, and human oversight" e permite "custom permission settings over what it
  can read, edit, or create". **Cético:** o blog institucional **não** detalha um "plano de passos
  editável antes de executar" nem HITL por passo no builder nativo; a supervisão declarada é
  principalmente **escopo de permissão** (o que o agente pode ler/editar/criar), não checkpoint de
  aprovação por ação. Arquitetura por baixo: **multi-agente com LangGraph**, com agentes especializados
  (retrieval, board actions, answer composition), preview e explainability (fonte secundária ZenML).

Confiança: **alta** para os slogans e o fluxo de workflow por linguagem natural (fonte primária monday);
**média** para o grau real de HITL/preview no produto (o marketing enfatiza permissão, não checkpoint).

### 2. Concorrentes de work management com agentes executores

**ClickUp — Brain + Autopilot Agents.** Metáfora: **bot no-code disparado por trigger/condição**. O que
executa de fato: atualizar status de projeto, criar tarefas a partir de notas de reunião, enviar e-mail
de update ao cliente, rodar standup diário/recap semanal, triagem de tickets, responder FAQ monitorando
chats. Você "constrói com prompts e triggers simples", posicionado como **"Zapier sem código"**. HITL: o
agente roda **recorrente sem prompt manual**; controle é na definição do trigger, não aprovação por
execução. Também cria **agentes dedicados** por tarefa automaticamente (Brain 2). Metáfora dominante:
**workflow/automação com cara de colega**, não copiloto conversacional.

**Asana — AI Studio + Smart Workflows.** Reposicionou o site inteiro para **"The OS for human-agent
teams"**. Builder **no-code de arrastar-e-soltar** para montar workflow agêntico conectado a qualquer
app; o agente "review work requests, evaluate briefs, and flag blockers" enquanto humanos mantêm
oversight. Diferencial de governança (o mais maduro do grupo): **"Every agent has an identity, scoped
permissions, an audit trail, and cost constraints"**, com acesso a dado, ações aprovadas e gasto geridos
num **console central**. Metáfora: **agente-como-membro-do-time com identidade e crachá**. Isso é o
padrão de "agente com cargo + trilha de auditoria + teto de custo" mais bem articulado do mercado
genérico.

**Notion — 3.0 AI Agents.** Agente pessoal roda **autonomamente por até ~20 min**, executa multi-etapa:
montar plano de projeto, compilar feedback de várias fontes, redigir relatório, **atualizar centenas de
entradas de database de uma vez**, criar páginas. **Cético e importante:** forte **dentro** do
ecossistema Notion; fraco fora dele — "the agent can search Slack channels but can't reply to a Slack
message; it can surface a Jira ticket but can't assign it or change its status". A profundidade da "ação"
ainda é **read-and-synthesize**, não **write-and-execute** cross-tool. Lição direta pro Pilar: **agente
que executa de verdade precisa mandar no sistema de registro** (o Notion manda no dele, o Pilar manda no
banco do escritório via RPC) — executar "por fora" é o que quebra.

**Linear — agents por delegação (o modelo mais limpo de HITL).** Metáfora: **"delegate an issue to an
agent"**. Você faz `@Cursor` (ou Devin/Copilot) num comentário ou **atribui o issue ao agente**; ele puxa
o contexto (descrição, comentários, referências), cria branch, abre PR e avisa quando está pronto pra
revisão. Dois padrões valiosos: (a) **o humano continua sendo o assignee principal, o agente entra como
"contributor"** (o agente não "rouba" a responsabilidade); (b) **regras de triagem** atribuem certos
tipos de tarefa ao agente automaticamente (evento → agente). Saída sempre passa por **review humano** (o
PR). É o padrão "agente é um colega a quem você delega, e o resultado volta pra sua aprovação".

Padrão transversal dos genéricos: **descreve em linguagem natural → vira sequência de passos/blocos →
executa → resultado volta pra revisão**; governança por **permissão/identidade/audit trail**; disparo por
**evento (trigger)** ou **pedido**. Nenhum deles tem contexto de engenharia/obra — são horizontais.

### 3. Vertical AEC/ConTech — o que já existe de agente executor (e a Vobi)

**Vobi (concorrente BR direto do Pilar) — já em produção, nov/2025.** Marketing agressivo: "o único
software de gestão de obras com Agentes de IA do Brasil". Três agentes com **função fixa**:

- **Agente Financeiro** (lançado 11/nov/2025, vendido como "o 1º Agente de IA Financeiro da construção
  civil"): recebe **foto/áudio/documento/mensagem via WhatsApp ou e-mail**, identifica valor,
  fornecedor, data e demais dados, e **gera lançamentos "prontos para revisão"**. Isso é o padrão HITL
  explícito: o agente executa a extração e o preenchimento, o humano confirma. Ataca exatamente a dor de
  "registrar despesa de obra" que o Pilar tem via import de extrato/fatura (spec 017).
- **Agente de Compras:** executa o fluxo **solicitação → cotação → ordem de compra**. Frases do site:
  "Envie uma foto, um áudio, documento ou texto pelo WhatsApp e o Agente de IA cria a solicitação
  automaticamente"; na cotação "envie o arquivo e o agente interpreta os itens, extrai preços e preenche
  tudo"; na OC "lê o documento, identifica fornecedor, itens e valores e cria a ordem de compra
  automaticamente". Trilha de auditoria: "**Cada ação do Agente gera um histórico completo**, desde o
  documento enviado, os dados identificados e as informações preenchidas". Slogan: "Pare de operar
  compras manualmente. Deixe a IA fazer isso por você."
- **Agente "secretária"** (administrativo).

**Cético sobre a Vobi:** o padrão real é **ingestão multimodal (WhatsApp) → extração → preenchimento na
plataforma, pronto para revisão**. É poderoso na captura (tirar o dado da cabeça/zap do gestor pro
sistema), mas o que confirmei **não** mostra o agente negociando com fornecedor, disparando cotação a 3
fornecedores por conta própria, nem decidindo compra: ele **transcreve e estrutura**, o humano decide. O
WhatsApp é o canal-chave (onde a obra brasileira já vive) e é uma vantagem de distribuição real da Vobi,
não só de IA. O canal certo importa tanto quanto o agente.

**ConTech global (referência de horizonte, não concorrente do ICP):**

- **Kreo / Caddie** — "full-fledged autonomous agent inside Kreo... reads your drawings, runs the
  measurements, and delivers exact quantities, under your control" — **agente executor de takeoff** (mede
  quantitativos a partir da planta, sob controle do usuário). Padrão: "AI operator living inside the
  software".
- **Beam AI** — extrai material e escopo de desenhos p/ takeoff/bid.
- **Boon** — agentes que se embutem no workflow de preconstruction/estimating/bid.
- **IntoAEC** — conecta estimating → BoQ → budget → scheduling → procurement, com "approved estimates
  feeding directly into project cost plans".

Leitura: no AEC global o agente executor mais maduro está em **quantitativo/orçamento a partir de
desenho** (takeoff), território de **construtora/estimator**, não do ICP do Pilar (engenharia
multidisciplinar que administra projeto/obra). Ninguém verticalizou o executor no **custo de projeto por
administração + prestação de contas**, que é o buraco do Pilar (ver ADR 0013, specs 016/018/019).

### 4. Padrões de design de "agente executor" que se repetem

Consolidando o que aparece em ≥2 produtos (cruzando com a nota temática [[agent-ux-patterns]]):

| Padrão | Quem faz | Vale pra engenharia? |
|---|---|---|
| **(a) Plano de passos gerado a partir de linguagem natural** | monday (workflow em blocos), Asana, ClickUp | **Sim**, mas o plano precisa ser em vocabulário do domínio (cotação/medição/aditivo), não "bloco genérico" |
| **(b) HITL / resultado "pronto para revisão"** | Vobi (lançamento pronto p/ revisão), Linear (PR pra aprovar), Notion (revisar antes de aplicar) | **Sim, é obrigatório** onde há dinheiro — casa com a aba "Revisão" que o Pilar já tem (`pending_review`) |
| **(c) Disparo por evento (trigger) vs. por pedido** | monday/ClickUp/Asana (trigger), Linear (regra de triagem) + pedido NL em todos | **Sim** — evento = "projeto entrou no vermelho", "custo passou do orçado" (ambient de margem, nível 3 já mapeado) |
| **(d) Agente com função/cargo fixo vs. genérico** | Vobi (Financeiro/Compras/Secretária), monday (Expert/sidekick) | **Sim** — cargo dá clareza e confiança; ICP entende "agente de compras" melhor que "IA" |
| **(e) Trilha de auditoria do que o agente fez** | Asana (audit trail + cost constraints), Vobi ("histórico completo de cada ação"), Linear (contributor no issue) | **Sim, é o moat de confiança** — casa com prestação de contas por administração |
| **(f) Identidade + escopo de permissão + teto de custo** | Asana (o mais maduro), monday | Parcial — ICP pequeno não quer console de governança; basta escopo por empresa (RLS) + "avisar antes de gastar" |
| **(g) Agente é "contributor", humano continua dono** | Linear | **Sim** — o sócio não quer que o robô assuma a responsabilidade, só faça o trabalho braçal |
| **(h) Ingestão multimodal por canal onde o usuário já vive (WhatsApp)** | Vobi | **Sim, e é subestimado** — a captura pelo canal certo é metade do valor; distribuição, não só IA |

Padrões que são **mais demo que produto** hoje (evitar no estágio do Pilar): **computer use / do-it-for-you**
(o agente clica telas) e **canvas/generative UI aberta**; console de governança pesado à la Asana é
overkill pro ICP.

### 5. Onde mora o diferencial de um agente executor no nicho de engenharia

O genérico (monday/ClickUp/Asana/Notion) executa **coordenação de trabalho** (status, tarefa, standup,
relatório). Nenhum entende **onde o dinheiro do projeto está**. O executor defensável do Pilar tem que
morar no que o horizontal não modela e a Vobi ainda não fez bem (a Vobi captura dado; o buraco é
**executar no ciclo de margem e prestação de contas por administração**):

1. **Agente de prestação de contas (cost-plus).** A partir das despesas da conta da obra (016) + decisões
   de cotação (018) + estoque (019), o agente **monta o relatório de prestação de contas ao cliente**
   (o que foi comprado, de quem, por quê aquele fornecedor, saldo dos dois bolsos, taxa de administração
   aplicada) — pronto para o sócio revisar e enviar. É execução multi-etapa real, no dado proprietário,
   com a auditoria embutida. Monday não tem os dois bolsos; a Vobi tem financeiro mas não o vende como
   prestação de contas por administração. **Este é o mais defensável.**
2. **Agente de margem proativo (ambient/evento).** Varre projetos, detecta "custo comprometido passou X%
   do orçado" ou "projeto vai fechar no vermelho", e empurra pro inbox de revisão com o número em R$ e a
   ação sugerida (aditivo, renegociar cotação). Isso é a tagline ("saiba se dá lucro antes de terminar")
   virando agente. Disparo por evento, não por pedido.
3. **Agente de cotação que fecha o loop, não só transcreve.** A Vobi para em "estruturou a cotação pronta
   pra revisão". O passo executor seguinte, defensável: dado o item, o agente **monta o mapa comparativo**
   (spec 018), **sinaliza o menor preço considerando prazo e condição**, e **registra a decisão justificada**
   — a saída não é "3 preços digitados", é "a escolha auditável para o cliente". A margem mora na decisão
   registrada, não na captura.
4. **Agente de medição/aditivo.** Ao detectar escopo executado além do contratado, sugere o **aditivo**
   com base no que o Pilar já modela (Projetos → Aditivos), pronto pra aprovar. Território que Monday não
   toca.

Regra de ouro do diferencial: **o executor genérico mexe em card; o executor de engenharia mexe em R$ do
projeto com trilha de prestação de contas.** O moat não é o modelo de IA (commodity), é o **dado
proprietário do escritório + o workflow de administração + a auditoria** — exatamente o que a literatura
de vertical AI aponta ([[the-era-of-the-ai-agent]], [[rise-of-vertical-ai-in-accounting]],
[[harvey-ai-vertical-legal-agent]]).

## Frameworks / números

- **Modelo mental canônico (guardar):** "You orchestrate, agents execute" (monday). Humano = estratégia e
  julgamento; agente = executa passos e devolve pronto para revisão.
- **Espinha do executor genérico:** pedido em linguagem natural (ou trigger de evento) → sequência de
  passos/blocos gerada → executa → **resultado pronto para revisão** → governança por permissão/audit.
- **Maturidade real (cético):** genéricos = automação declarada + read-and-synthesize dentro do próprio
  ecossistema (Notion admite não escrever cross-tool); Vobi = ingestão multimodal → extração → preenche
  pronto pra revisão (não decide/negocia). **Write-and-execute com consequência ainda é HITL em todos.**
- **8 padrões de design** tabelados acima; os que valem pra engenharia: (a) plano em vocabulário do
  domínio, (b) HITL onde há dinheiro, (c) disparo por evento, (d) cargo fixo, (e) audit trail = moat de
  confiança, (g) agente contributor/humano dono, (h) captura pelo canal certo.
- **Vobi timeline:** Agente Financeiro lançado **11/nov/2025**; Compras e Secretária no mesmo movimento.

## Citações

> "You orchestrate, agents execute." (monday.com, Welcome to the Agentic Era, acesso 2026-08-11)

> "By monitoring your boards, the agents will detect what needs attention and take action automatically."
> (monday.com, acesso 2026-08-11)

> "Every agent has an identity, scoped permissions, an audit trail, and cost constraints." (Asana,
> AI Studio / Smart Workflow Gallery, acesso 2026-08-11)

> "The agent can search Slack channels but can't reply to a Slack message; it can surface a Jira ticket
> but can't assign it or change its status." (síntese de reviews do Notion 3.0, acesso 2026-08-11)

> "Envie uma foto, um áudio, documento ou texto pelo WhatsApp e o Agente de IA cria a solicitação
> automaticamente na plataforma." (Vobi, Agente de IA de Compras, acesso 2026-08-11)

> "Cada ação do Agente gera um histórico completo, desde o documento enviado, os dados identificados e as
> informações preenchidas automaticamente." (Vobi, Agente de IA de Compras, acesso 2026-08-11)

> "...a IA identifica automaticamente valores, fornecedores, datas... gerando lançamentos prontos para
> revisão." (Vobi, Agente de IA Financeiro, press nov/2025, acesso 2026-08-11)

> "Caddie is a full-fledged autonomous agent inside Kreo — it reads your drawings, runs the measurements,
> and delivers exact quantities, under your control." (Kreo, acesso 2026-08-11)

## Aplicação ao Pilar

**Contexto:** o CEO quer que os agentes deixem de ser consultivos/engessados e passem a executar tarefas
multi-etapa (referência: a home nova da monday). O Pilar já tem a fundação: 3 agentes de domínio,
`agent_runs`/`agent_actions`, cards de confirmação e a aba "Revisão" (`pending_review`). Ou seja, o motor
de "executar → devolver pra revisão" já existe; falta **promover e verticalizar**.

**Direção recomendada (concreta, ancorada no que o mercado validou):**

1. **Adotar o modelo mental "você orquestra, os agentes executam" como espinha de UX** e promover a aba
   "Revisão" a **home dos agentes = inbox de trabalho** (padrão HITL + [[agent-ux-patterns]]). Cada item:
   o que o agente fez, o R$ envolvido, verbo de ação (aprovar/editar). Isso comunica "os agentes já
   trabalharam" sem cara de chatbot, reaproveitando `pending_review`. É o que monday/Asana/Linear fazem, e
   o que a Vobi entrega como "pronto para revisão".

2. **Dar cargo fixo aos agentes do Pilar** (padrão d, que a Vobi já explora): "Agente de prestação de
   contas", "Agente de margem", "Agente de cotação". Cargo > "IA": o ICP confia mais em um papel claro. NÃO
   copiar o "console de governança com teto de custo" da Asana (overkill pro ICP); basta escopo por empresa
   (RLS já existe) + "avisar antes de gastar".

3. **Verticalizar o executor onde a Vobi/Monday não chegam** (seção 5): o mais defensável é o **agente de
   prestação de contas por administração** (dois bolsos + taxa + decisão de cotação → relatório pronto ao
   cliente), seguido do **agente de margem proativo** (evento, não pedido). Isso usa o dado proprietário do
   escritório e a auditoria como moat, não o modelo de IA.

4. **Fechar o loop da cotação, não só capturar** (spec 018): o passo executor que diferencia é **montar o
   mapa comparativo + sinalizar o menor preço com prazo/condição + registrar decisão justificada**, porque
   a margem mora na decisão auditável, não na transcrição dos 3 preços. A Vobi para na captura; aqui está o
   passo a mais.

5. **Não perseguir o que é demo:** computer use, canvas aberta, e "agente que negocia sozinho com
   fornecedor". Manter **HITL onde há dinheiro** (o sócio é o dono, o agente é contributor — padrão Linear).

**Ameaça a registrar:** a Vobi já ocupou o slogan "único software de obras com agentes de IA do Brasil" e
tem **distribuição via WhatsApp** (canal onde a obra vive) — vantagem de captura que o Pilar não tem hoje.
O Pilar não ganha essa corrida no "temos um agente"; ganha em **onde o agente executa** (margem/prestação
de contas por administração) e no ICP diferente (engenharia multidisciplinar, não construtora/arquiteto).
Recomendo: não vender "agentes de IA" genérico contra a Vobi; vender "o escritório sabe se cada projeto
dá lucro porque os agentes fecham a prestação de contas sozinhos".

## Fontes

- monday.com — Welcome to the Agentic Era: https://monday.com/blog/product/welcome-to-the-agentic-era-at-monday-com/
- monday.com — Platform-Wide AI Shift / Work Execution Era (press): https://monday.com/p/press-release/monday-com-unveils-platform-wide-ai-shift-the-work-execution-era-arrives/
- monday.com — Welcomes AI Agents (IR): https://ir.monday.com/news-and-events/news-releases/news-details/2026/monday-com-Welcomes-AI-Agents-to-Its-Platform-Marking-a-Shift-in-How-Work-Gets-Done/default.aspx
- ZenML LLMOps — monday.com Digital Workforce / multi-agent LangGraph: https://www.zenml.io/llmops-database/building-a-digital-workforce-with-multi-agent-systems-and-user-centric-design
- ClickUp — What is ClickUp Brain (help): https://help.clickup.com/hc/en-us/articles/12578085238039-What-is-ClickUp-Brain
- ClickUp Brain autonomous agents (CryptoBriefing): https://cryptobriefing.com/clickup-brain-ai-autonomous-agents/
- Asana — Smart Workflow Gallery (IR): https://investors.asana.com/news-releases/news-release-details/asana-launches-smart-workflow-gallery-blueprint-effective-human
- Asana — AI Studio: https://asana.com/product/ai/ai-studio
- Notion 3.0 AI Agents (TechAhead): https://www.techaheadcorp.com/blog/notion-3-ai-agents/
- Notion AI review (eesel): https://www.eesel.ai/blog/notion-ai-review
- Linear — Agents / delegation: https://linear.app/agents  ·  https://linear.app/docs/assigning-issues
- Cursor × Linear (Cursor blog): https://cursor.com/blog/linear
- Vobi — Agente de IA de Compras: https://www.vobi.com.br/funcionalidades/agente-de-ia-de-compras
- Vobi — 1º Agente de IA Financeiro da construção civil: https://www.vobi.com.br/blog/o-primeiro-agente-de-ia-financeiro-da-construcao-civil
- Vobi — anúncio Agente Financeiro (sistemadegestaodeobras): https://www.sistemadegestaodeobras.com.br/blog/vobi-anuncia-agente-de-ia-financeiro-para-construcao-civil
- BuiltWorlds — 40 AI-Driven AEC Solutions 2026: https://builtworlds.com/news/40-ai-driven-aec-solutions-to-know-in-2026/
- Kreo (Caddie agent): https://www.kreo.net/  ·  Beam AI: https://www.ibeam.ai/

## Relacionadas

[[agent-ux-patterns]]
[[the-era-of-the-ai-agent]]
[[rise-of-vertical-ai-in-accounting]]
[[harvey-ai-vertical-legal-agent]]
[[suprimentos-compras-cotacao-contratos-fluxo]]
[[docs/specs/018-cotacoes-na-obra.md]]
[[docs/specs/007-mesa-de-trabalho-agentes.md]]
[[docs/strategy/ANALISE_COMPETITIVA_VOBI.md]]
