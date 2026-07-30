# SPEC: Mesa de trabalho dos agentes (inbox-first)

**Data:** 2026-07-30
**Status:** Proposta (aguardando aprovação)
**Autor:** Matheus Rezende
**Módulo:** agentes (ai_chat)

## Problema

A tela `/agentes` hoje abre no modo **conversa** (chat com balões + input). Isso
comunica "digite sua pergunta", não "os agentes trabalham para o seu escritório".
O dono não quer a cara de chatbot: quer entrar e já ver o que os agentes fizeram,
poder abrir um item e ver o raciocínio de cada agente em tempo real, e ter a
conversa como um modo secundário, não como a tela principal.

A pesquisa de mercado (2025-2026) confirma que "chat-first falha" para agentes que
executam trabalho: o padrão que vinga é o **agent inbox** (fila de trabalho estilo
caixa de entrada, com estados e aprovação humana), com **generative UI** (a
resposta vira card acionável) e **streaming do raciocínio** (mostrar o agente
trabalhando). Ver `research/themes/agent-ux-patterns.md`.

## Objetivo

Reenquadrar `/agentes` como uma **mesa de trabalho**: a fila (Revisão) é a porta de
entrada, mostra o que precisa de decisão, o que está em andamento e o histórico do
que já foi concluído; abrir um item revela o raciocínio dos agentes; a conversa
continua acessível, com destaque, como modo secundário.

Não é reconstruir do zero: o motor de dados já existe (`agent_runs` +
`agent_actions`) e é reaproveitado. Troca-se a apresentação, não o cérebro.

**Fora de escopo:**

- Não remover o chat (ele funciona e tem a11y, deep-link, persistência). Ele é
  rebaixado a modo secundário, não deletado.
- Não remover "Agentes" da sidebar (decisão do dono: manter).
- Não implementar autonomia total ("os agentes decidem e executam sozinhos"). Todo
  write continua passando por aprovação humana.
- Fase 3 (execução assíncrona e agente proativo de margem) não entra nas fases 1-2.

## O que já existe (aproveitar, não reconstruir)

- **`agent_runs`** (migration `20260610000000_agent_runs_foundation`): máquina de
  estados `queued → running → pending_review → approved → executed`
  (+ `rejected`/`failed`), com `result`, `confidence`, `version`, tokens, RLS por
  empresa. É o modelo da fila.
- **`agent_actions`**: log de cada tool/passo de um run, feito para ser "exibido
  como log de raciocínio no cockpit". É a fonte do modal de raciocínio.
- **`ai-chat`** já cria runs `pending_review` para drafts de criação (lead,
  projeto, lançamento) e para operações.
- **RPCs de escrita `*_agente`**: seguras desde o hardening
  `20260715000033_agent_rpc_tenancy_hardening` (checagem de empresa + gate de papel
  `user_has_feature(..., 'editor')` + validação cross-tenant das FKs).
- **`chat_sessions` / `chat_messages`**: a conversa já é persistida no banco (hoje
  o front reidrata só do localStorage; o histórico do banco existe mas não é lido).

## O que NÃO existe (é trabalho novo)

- **Raciocínio passo-a-passo real:** `ai-chat` grava só uma linha em
  `agent_actions` (`extrair_<entidade>`). Um log "buscando receitas... lendo
  projeto X..." exige instrumentar a edge function para emitir cada passo.
- **Tempo real:** o front não usa Supabase Realtime em lugar nenhum. "Ver em tempo
  real" exige subscription (ou polling) sobre `agent_runs`/`agent_actions`.
- **Execução assíncrona ("sair e os agentes continuam"):** hoje `ai-chat` é 100%
  síncrono (SSE na mesma conexão; sair da tela aborta). Rodar em background é
  mudança de arquitetura (fila/worker desacoplado da conexão HTTP).
- **Agente proativo autônomo ("seu projeto vai fechar no vermelho"):** depende de
  margem confiável, que é a `spec 004-margem-confiavel` (Rentabilidade dormente).

## Faseamento

### Fase 1 — Mesa de trabalho (só front, dados que já existem)

Alto valor, baixo risco. Entrega a cara de "agentes trabalham pro escritório" sem
backend novo.

1. Ao abrir `/agentes`, a landing é a **fila de trabalho** (Revisão), não a conversa.
2. A fila deixa de mostrar só `orcamento_honorarios`: passa a listar todos os
   `agent_runs` da empresa, como lista/cards, agrupados por estado:
   - **Precisa de você** (`pending_review`): decisão pendente, com valor e ação.
   - **Concluído** (`approved`/`executed`): o que os agentes já resolveram.
   - **Arquivado** (`rejected` e itens antigos): histórico, recolhido num canto.
3. Concluir/aprovar um item o move de "precisa de você" para "concluído"; o
   histórico permanece acessível (não some).
4. A **conversa** vira um botão/entrada com destaque ("Nova conversa"), não uma aba
   escondida. Repensar a troca Revisão↔Conversa (o dono não gostou das tabs atuais).
5. "Agentes" permanece na sidebar.

**Critério de aceite:** entrar em `/agentes` mostra a fila primeiro; um draft criado
pelo chat aparece na fila; aprovar move para concluído; o histórico continua
visível; iniciar conversa é óbvio.

### Fase 2 — Raciocínio visível em tempo real

6. Clicar num item abre um **modal de detalhe** com a timeline de `agent_actions`
   (o raciocínio: que dados o agente leu, que passos deu) em linguagem de
   engenheiro.
7. Atualização **em tempo real** via Supabase Realtime (subscription em
   `agent_actions`/`agent_runs` do run aberto), com fallback de polling.
8. Instrumentar `ai-chat` (e demais `ai-*`) para gravar cada passo relevante em
   `agent_actions`, não só a linha final.

**Critério de aceite:** ao abrir um run em andamento, os passos aparecem
progressivamente sem refresh manual.

### Fase 3 — Agentes proativos e assíncronos (o "extraordinário")

9. Execução assíncrona: pedir algo, sair da tela, e o run continuar em background,
   aparecendo como "em andamento" e depois "concluído" na fila.
10. Agente proativo de margem: varre projetos e cria runs do tipo "notify"
    ("PRJ-014 vai fechar no vermelho") na própria fila. Depende de `spec 004`.

**Pré-requisitos:** margem confiável (`spec 004`); arquitetura de execução em
background; reavaliar segurança/limites de qualquer passo que ganhe autonomia.

## Riscos e questões em aberto

- **Segurança das escritas:** o caminho de escrita do agente já está endurecido
  (hardening acima). Autonomia nova na Fase 3 exige nova avaliação.
- **Misturar sinais determinísticos com runs de IA:** o "Radar" da Início já
  detecta projeto atrasado/vencido sem IA. Decidir se esses alertas entram na mesma
  fila dos runs de IA ou ficam separados (risco de confundir "o agente pensou" com
  "uma query achou"). **Em aberto.**
- **Arquivamento/histórico:** granularidade (arquivar item a item? conversa
  inteira?), onde vive o histórico, por quanto tempo. **Em aberto.**
- **Conversa vs fila (navegação):** tabs, botão, ou split. **Em aberto** (o dono
  quer mais visibilidade para a conversa, sem as tabs atuais).
- **Mobile:** a fila + modal de raciocínio precisa funcionar em tela pequena.
- **Teatro vs substância:** "agentes trabalhando" não pode ser animação sobre
  latência; só tem valor se o passo mostrado for real (`agent_actions` de verdade).

## Relacionados

- `research/themes/agent-ux-patterns.md` (estado da arte de UX de agentes)
- `spec 004-margem-confiavel` (pré-requisito do agente proativo)
- `docs/strategy/VISAO_AGENTICA_PRODUTO.md` (visão macro; "interface é commodity, o
  diferencial é o cérebro")
- Migrations: `20260610000000_agent_runs_foundation`,
  `20260715000033_agent_rpc_tenancy_hardening`
