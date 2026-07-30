# SPEC: Criação leve de projeto + acabamento da unidade de trabalho

**Data:** 2026-07-30
**Status:** Rascunho (Passo 0 de validação pendente antes da Fase 2)
**Autor:** Matheus Rezende
**Módulo:** projetos / gestao

## Problema

O CEO usa ClickUp e Trello e sentiu duas coisas boas nesses produtos que o Pilar não
dá: (1) **criar uma unidade de trabalho é instantâneo** (um card nasce com um título,
detalhe depois); (2) **a unidade tem acabamento** (comentários com histórico, links,
anexos, labels, status arrastável). No Pilar, criar trabalho começa pelo
`ProjetoFormDialog` — um wizard de 3 passos (Identificação → Escopo & Prazo →
Disciplinas) que exige código, cliente, valor, parcelas, prazos e equipe **antes de
salvar**. Isso dá a sensação de que "criar projeto é difícil".

Um painel de três lentes (produto, ICP, red-team, 2026-07-30) analisou a hipótese de
trocar o modelo hierárquico (Projeto → disciplinas) por uma unidade **flat** estilo
task/card. Veredito unânime: **não trocar o modelo.** A margem por projeto — a razão de
existir do Pilar ("saiba se cada projeto está dando lucro") — é calculada no grão de
`projeto_id` (`src/hooks/useRentabilidade.ts:39-46`: `receitas - despesas`), e 15+
tabelas (faturas, marcos, portal, folha, cronograma) penduram nela. Achatar dissolveria
a entidade que gera o número e reabriria a "armadilha Monday" que o painel já recusou
por unanimidade (spec 008, "Fora de escopo"; `research/aec/monday-com-benchmark-2026.md`).

O diagnóstico correto: o CEO juntou **dois problemas** num pedido. "Criar é difícil" é
**UX de criação**, não o modelo — e o próprio código prova, porque `QuickAddCard.tsx`
já cria projeto válido com **3 campos**. "Quero o acabamento do ClickUp" é **feature em
cima do modelo atual** — a disciplina já é um card rico (`DisciplinaDetailDialog.tsx`:
status, prioridade, 3 datas, thread de observações com autor); falta labels, anexos e
links. Esta spec ataca esses dois, sem tocar na fundação que gera a margem.

## Objetivo

Duas frentes independentes, entregáveis em sequência:

- **Frente A — Criação leve (rápida, zero migration):** criar um projeto deve ser tão
  barato quanto criar um card. Nome + cliente agora, o resto (financeiro, disciplinas,
  datas) por disclosure progressivo depois. O caminho pesado continua existindo para
  quem quer preencher tudo de uma vez.
- **Frente B — Acabamento da unidade de trabalho:** disciplina e tarefa ganham labels,
  links e anexos (e a tarefa ganha comentários, que a disciplina já tem). O trabalho
  passa a carregar seu contexto (o combinado, a versão do arquivo, o porquê), como no
  card do ClickUp/Trello, **sem** virar board genérico.

## Passo 0 — Validar antes de codar a Frente B (não pular)

A Frente B custa migration e é onde mora o risco de construir enfeite. Antes dela,
fazer as duas perguntas que o painel e a decisão de 2026-07-25 já mandavam fazer, à
**VRZ (usando de verdade)** e à **BM3 (testando)**:

1. Onde vocês controlam tarefas internas hoje (as que não valem virar projeto)? Em quê,
   e o que faria migrar isso pro Pilar?
2. Quando abrem uma disciplina/tarefa, o que sentem falta de anexar ou registrar ali
   (arquivo, link, comentário)? O que hoje se perde no WhatsApp/e-mail?

Se a resposta não pedir labels/anexos/links, a Frente B encolhe ou espera. A Frente A
independe dessa validação (é UX pura) e pode ir já.

## Fora de escopo (recusado pelo painel — não reabrir sem gatilho)

- **Achatar o modelo:** projeto NÃO vira campo/tag de uma task flat. A entidade projeto
  continua sendo a espinha faturável e o grão da margem.
- **Board genérico configurável** (colunas customizáveis, tipos de coluna, "add
  column"): é a armadilha Monday, já recusada (spec 008). Gatilho para reabrir a decisão
  de modelo: um prospect recusar o pacote por escrito. Não aconteceu.
- **Horas estimadas/reais na unidade agora:** campo de hora sem resolver _quem alimenta_
  é a terceira encarnação do timesheet morto (`009_timesheets_alocacoes.sql` →
  `20260429000001_drop_timesheets.sql`; spec 012, D1). Horas entram junto com a captura
  de horas (gate 2), pelo gesto de concluir a disciplina, não como campo solto. Fora
  desta spec.
- **Drag-and-drop de status** no card avulso: agrupamento por status já existe; DnD é
  follow-up, não requisito.

## O que já existe (aproveitar)

- **`src/pages/projetos/components/QuickAddCard.tsx`**: já cria projeto com 3 campos
  (código, nome, cliente) via RPC `create_projeto_completo` com `p_disciplinas: []` e
  `p_valor_contrato: 0`. Prova de que o modelo aceita projeto raso. Hoje só aparece
  dentro das colunas do board.
- **`ProjetoFormDialog.tsx` + `useProjetoForm.ts`**: o wizard de 3 passos (o caminho
  pesado). Vira "adicionar detalhes", não a porta de entrada padrão.
- **`Projetos.tsx:98,254`**: `handleNewProjeto` abre o `ProjetoFormDialog`; é o ponto a
  trocar para o caminho leve.
- **`DisciplinaDetailDialog.tsx`**: disciplina já tem status, prioridade, 3 datas e
  thread de observações (`obs.texto`/`obs.usuario`/`obs.data`). Falta labels/links/anexos.
- **`src/pages/meu-trabalho/components/TarefaDialog.tsx`** (spec 008): tarefa tem título,
  descrição, status, prazo, responsável. Falta comentários/labels/links/anexos.
- **Padrão de upload já existe** (`storage.from(...).upload(...)`) em
  `PortalEntregas.tsx`, `EntregaveisTab.tsx`, `Empresa.tsx`, `usePropostaTemplates.ts`.
  Anexos reusam esse padrão, sem inventar infra de storage.

## Requisitos

Funcionais (numerados, testáveis):

**Frente A — Criação leve**

1. O botão "Novo projeto" (`Projetos.tsx:254`) abre por padrão um formulário mínimo:
   nome (obrigatório), cliente (obrigatório), código (obrigatório ou autogerado). Salva
   e o projeto já existe, sem exigir financeiro nem disciplina.
2. O formulário mínimo tem um caminho claro para "adicionar detalhes" (financeiro,
   disciplinas, datas), abrindo o fluxo completo atual — que continua disponível.
3. Um projeto criado leve aparece no board/lista imediatamente, com margem vazia (é
   honesto: sem receita/despesa ainda não há número), sem erro nem estado quebrado.

**Frente B — Acabamento (após Passo 0)** 4. Disciplina e tarefa aceitam **labels** (etiquetas curtas coloridas), múltiplas. 5. Disciplina e tarefa aceitam **links** (URL + rótulo opcional), múltiplos, clicáveis. 6. Disciplina e tarefa aceitam **anexos** (upload via storage), listados com nome e
ação de baixar/remover. 7. Tarefa ganha **comentários** com autor e data (o que a disciplina já tem em
`observacoes`); mesmo padrão visual das observações da disciplina.

Não-funcionais:

- **Segurança / RLS:** labels, links, anexos e comentários herdam o escopo de
  `empresa_id` da entidade dona (disciplina via `projetos.empresa_id`; tarefa via
  `tarefas.empresa_id`). Nenhum item cross-tenant. Anexo em bucket com policy por
  empresa (padrão de `portal_entregas`).
- **Sem regressão financeira:** nada nesta spec toca `useRentabilidade`, faturas,
  marcos ou o grão `projeto_id`. A margem por projeto permanece idêntica.
- **UX:** criação leve com foco automático no primeiro campo; feedback com `useToast`;
  microcopy em sentence case, verbo de ação.

## Critérios de aceite

- [ ] Criação leve: dado que clico "Novo projeto", quando preencho só nome e cliente e
      salvo, então o projeto é criado e aparece na lista, sem me pedir financeiro ou
      disciplina.
- [ ] Dado um projeto criado leve, quando abro a rentabilidade, então a margem aparece
      vazia/zerada (não quebra, não inventa número).
- [ ] Dado o formulário mínimo, quando escolho "adicionar detalhes", então abro o fluxo
      completo atual sem perder o que já preenchi.
- [ ] Acabamento: dado uma disciplina, quando adiciono uma label, um link e um anexo,
      então os três persistem e reaparecem ao reabrir; o anexo baixa.
- [ ] Dado uma tarefa avulsa, quando escrevo um comentário, então ele aparece com meu
      nome e data (igual às observações da disciplina).
- [ ] Multi-tenant: dado um usuário de outra empresa, então não vê label/link/anexo/
      comentário de disciplina nem tarefa da minha empresa.
- [ ] Sem regressão: os testes de rentabilidade/faturamento existentes seguem verdes.

## Dados e contratos

**Frente A:** zero migration. Reusa `create_projeto_completo` (já aceita disciplinas
vazias e valor 0). Se o código do projeto virar autogerado, isso é UI + default, não
schema.

**Frente B (confirmar após Passo 0):** decisão de forma dos anexos/labels/links —
opções a bater o martelo:

- **(recomendado) por entidade, explícito:** colunas/tabelas dedicadas ligando a
  `projeto_disciplinas.id` e a `tarefas.id` (ex.: `disciplina_anexos`, `tarefa_anexos`,
  ou uma coluna `labels text[]` e `links jsonb` em cada). Evita tabela polimórfica
  genérica (o Pilar recusa o genérico).
- Comentário da tarefa: espelha o shape de `observacoes` da disciplina
  (`{ texto, usuario, data }`), para reusar o componente de thread.
- Anexos: bucket de storage com policy por `empresa_id`, padrão `portal_entregas`.

Registrar a forma final como parte desta spec antes de codar a Frente B. Se envolver
tabela nova: migration + `npm run gen:types` (staging, ADR 0007) + commit do `types.ts`.

## Plano de implementação

**Frente A (primeiro, XS, sem dependências)**

1. Trocar `handleNewProjeto` para abrir o formulário mínimo (reaproveitar a lógica do
   `QuickAddCard`), com disclosure progressivo para o fluxo completo.
   _Verificação:_ criar projeto com 2 campos; confirmar que aparece e que a margem fica
   vazia sem erro.

**Passo 0 (em paralelo à Frente A):** as duas perguntas à VRZ e BM3. Decide o escopo da
Frente B.

**Frente B (só após Passo 0 confirmar demanda)** 2. Fechar o contrato de dados (seção acima) e, se preciso, migration + tipos. 3. Componente de labels reutilizável; plugar em disciplina e tarefa. 4. Componente de links reutilizável; plugar nos dois. 5. Anexos via storage (padrão `portal_entregas`); plugar nos dois. 6. Comentários na tarefa reusando o componente de thread da disciplina. 7. Testes dos critérios de aceite (RLS multi-tenant, persistência, sem regressão
financeira).

## Decisões e riscos

- **Risco de enfeite (Frente B).** Adicionar labels/anexos/links sem demanda validada é
  construir acabamento que ninguém usa. Mitigação: Passo 0 antes de codar a Frente B; a
  Frente A (a dor principal) não depende disso.
- **Não reabrir o modelo.** Achatar foi recusado por painel unânime; esta spec é
  explicitamente o caminho que preserva a hierarquia. Reabrir exige o gatilho escrito.
- **Horas ficam de fora** e entram pela porta da captura de horas (gate 2), não aqui.
- **Criação leve não é decisão transversal** (é UX de fluxo): não precisa de ADR nem
  migration. A forma dos anexos/labels da Frente B, se criar tabela, é registrada nesta
  spec, não em ADR (não é escolha de stack/arquitetura).

## Estado da implementação (2026-07-30, banco LOCAL)

- **Frente A DESCARTADA a pedido (2026-07-30).** A criação rápida (dialog leve
  `NovoProjetoDialog`) foi removida: "Novo projeto" **sempre** abre o formulário
  completo (`ProjetoFormDialog`). O componente leve foi apagado e o botão religado.
- **Código do projeto agora é automático (2026-07-30).** O campo código saiu do
  formulário de criação; no submit de criação o `useProjetoForm` gera `PRJ-XXXX`
  sequencial por empresa (client-side, RLS escopa) e passa à RPC. Em edição o código
  existente é preservado (não é editável). O geocode pós-criação passou a usar o id
  retornado pela RPC (antes casava por `codigo_projeto`, que não é mais digitado).
- **Frente B, onda 1 pronta** (sem storage): migration
  `20260730000200_disciplina_tarefa_acabamento.sql` (labels `text[]` + links `jsonb` em
  `projeto_disciplinas` e `tarefas`; `comentarios jsonb` em `tarefas`) aplicada no banco
  local; `types.ts` atualizado por splice. Componentes reutilizáveis `LabelsEditor` e
  `LinksEditor`. Disciplina (detalhe do projeto) ganhou labels+links; tarefa ganhou
  labels+links+comentários. Rascunho pré-save (chat/criação) omite a seção
  (handlers opcionais). `typecheck` verde, `lint` sem erros.
- **Frente B, onda 2 pronta (anexos).** Migration
  `20260730000300_anexos_disciplina_tarefa.sql` (aplicada no local): tabela `anexos`
  (metadados, `entidade` ∈ {disciplina, tarefa} + `entidade_id`, RLS por empresa) +
  bucket privado `anexos` com policies por empresa (padrão `portal-entregas`, path
  `{empresa}/{entidade}/{id}/{uuid}/{nome}`). Componente `AnexosEditor` (upload, lista,
  download por signed URL, remover); plugado na disciplina (só persistida) e na tarefa
  (edição). `types.ts` com o bloco `anexos` por splice. RLS/policies conferidas no banco.
  Decisão de modelo: uma tabela com `entidade` de 2 valores (não polimórfica aberta),
  escolha DRY consciente vs. a sugestão "por entidade" da seção Dados.
  **Revertido (CEO, 2026-07-30):** anexo entra por LINK externo, o Pilar não hospeda
  binário (ver spec 014). A onda 2 nunca chegou a staging; as migrations de criar e
  dropar `anexos` foram removidas do branch (se anulavam) em vez de shipar o par.
- **Pendente:** Passo 0 (perguntas à VRZ/BM3) — pulado a pedido; validar antes de
  investir mais na Frente B. Testes automatizados (Vitest) dos critérios de aceite.
  Nada aplicado em staging/prod.

- **Modal da disciplina no padrão ClickUp (2026-07-30).** Migration
  `20260730140000_disciplina_horas_descricao_comentarios.sql` (local): `horas_realizadas`,
  `descricao`, `comentarios jsonb` em `projeto_disciplinas`. `DisciplinaDetailDialog`
  reescrito (corpo remontado por `key`): status/responsável/prioridade/datas, **horas
  estimadas + reais** (salvam no blur), **descrição**, etiquetas/links/anexos, e uma
  seção **Atividades** (comentários estruturados com autor/data e **@menção** de pessoas
  do projeto; grava `mencionados` para notificação futura, ainda sem entrega de
  notificação). Fluxos pré-save (chat/criação) mantêm o fallback de "observações" sem
  alteração. Cadeia toda ligada (tipos → `useProjetoDisciplinas` → `useProjetoDetail` →
  `ProjetoDetailTabs`); `types.ts` por splice; `typecheck` verde. Pendente: entrega real
  da notificação de @menção; testes.

- **Modal de detalhe do projeto (`ProjectDetailDialog`) — Fase 1 (2026-07-30).** O
  header deixou de destacar o código: agora o **nome** é o título, **cliente** vem
  logo abaixo com ícone, e o código virou uma tag mono pequena. As disciplinas
  deixaram de ter Select de status inline; cada linha é um **botão que abre o modal
  rico da disciplina** (`DisciplinaDetailDialog`), onde se edita tudo (status, horas,
  descrição, atividades). A troca de status pelo modal ainda passa pelas travas de
  justificativa/data (via `handleDisciplineStatusChange`). Wiring reusa
  `useProjetoDetail(projeto.id)` (catálogo/pessoas/`handleSaveDiscChanges`; query de
  disciplinas deduplicada). `typecheck` verde.
- **Modal do projeto — Fase 2 pronta (2026-07-30).** Migration
  `20260730150000_projeto_atividades.sql` (local): `comentarios` e `links` jsonb em
  `projetos`. O modal virou **2 colunas**: disciplinas à esquerda, **painel de
  Atividades do projeto à direita** (`ProjetoAtividadesPanel`) com links e comentários
  com autor/data e @menção de pessoas. `types.ts` por splice; `typecheck` verde.
- **Pendente (transversal):** entrega real da notificação de @menção (disciplina e
  projeto guardam `mencionados`, mas ninguém é avisado ainda); testes; subir do local
  para staging.

- **Correção de UX dos modais (2026-07-30, verificado no Chrome).** Achados na
  inspeção: o modal da disciplina tinha virado um formulário vertical longo (não o
  ClickUp) e abria **por cima** do modal do projeto (dois overlays); inputs de link
  truncavam em coluna estreita. Corrigido: (1) `DisciplinaDetailDialog` reescrito em
  **2 colunas** (esquerda: descrição + links + anexos + Atividades; direita:
  propriedades compactas — status, responsável, disciplina, prioridade, datas, horas
  est/reais, etiquetas); (2) ao clicar numa disciplina o modal do projeto **fecha** e
  o da disciplina abre (overlay único); ao fechar a disciplina o do projeto reabre;
  (3) `LinksEditor` com composer empilhado (URL em cima, rótulo + Add embaixo) — some
  o truncamento nos dois modais; (4) `onBlur` de descrição/horas só grava se mudou
  (fim do save/toast "Disciplina atualizada" fantasma ao só abrir e fechar). `typecheck`
  verde, sem erros de lint nos arquivos tocados.

- **Modal da disciplina full-screen padrão ClickUp (2026-07-30).** Depois de duas
  iterações "apertadas", o CEO apontou a task view do ClickUp (ENG-518) como
  referência. Redesenho final: `DialogContent` quase full-screen
  (`max-w-none w-[96vw] h-[92vh]`), tag "DISCIPLINA" + título grande no topo, corpo em
  `ResizablePanelGroup` — **coluna principal** com propriedades em grade 2 colunas
  (ícone + rótulo + controle: Status | Responsável, Prioridade | Disciplina, Horas
  est. | reais, Datas, Etiquetas) + Descrição + Links + Anexos, e **coluna Atividades
  redimensionável** (handle arrastável) com o compositor fixo no rodapé. Pendente
  (mencionado pelo CEO): deep-link do item na URL — a disciplina não tem código curto
  (tipo ENG-518), então exige decidir o formato; e aplicar o mesmo full-screen ao modal
  do projeto.

- **Full-screen ClickUp nos dois modais + código DISC (2026-07-30).** Migration
  `20260730160000_disciplina_codigo.sql`: coluna `codigo` em `projeto_disciplinas`,
  sequencial por projeto (`DISC-001`), com backfill das existentes e trigger de geração
  no insert. Ambos os modais (`ProjectDetailDialog` e `DisciplinaDetailDialog`) agora
  são quase full-screen (`max-w-none w-[96vw] h-[92vh]`) com `ResizablePanelGroup` —
  coluna principal + **coluna de Atividades redimensionável**. O código aparece como
  **tag no topo** (PRJ-0003 no projeto, DISC-001 na disciplina). Verificado no Chrome.
- **Deep-link do código na URL — NÃO feito, por conflito real.** A página de Projetos
  já usa a query string para os filtros (`useProjetosUrlState`), inclusive o param
  `disc` (filtro de disciplina), e reconstrói a query apagando params estranhos. Botar
  o código do item na URL exige renomear o param do filtro ou usar rota dedicada
  (`/projetos/:id/disc/:codigo`) — follow-up próprio, não um hack sobre o filtro.

- **Refino dos modais no padrão do chat (2026-07-30, verificado no Chrome).**
  Compositor de atividade reescrito como `AtividadeComposer` (padrão do `InputPanel` do
  chat de Agentes): textarea sem moldura em caixa arredondada, botão @ para mencionar e
  botão de enviar em seta (`bg-brand`), Enter envia. Some o botão "Marcar"/"Comentar"
  textual. `LinksEditor` perdeu o campo rótulo (só URL). `LabelsEditor` com mais
  presença (h-8, chips maiores). Anexos removidos do modal da disciplina (decisão: tudo
  via link — `AnexosEditor` segue só na tarefa por ora). Modal do projeto: a lateral
  ficou **só Atividades** e os **Links foram para o conteúdo** (abaixo das disciplinas);
  hook `useProjetoAtividades` compartilha comentários+links (uma query). A lista de
  disciplinas do projeto passou a mostrar responsável, previsão e data de conclusão,
  além do status. `typecheck` verde; comentar testado ponta a ponta.

## Relacionados

- `docs/specs/008-gestao-meu-trabalho.md` (tabela `tarefas`, thread de observações,
  recusa do board genérico)
- `docs/specs/012-gestao-workload-e-cronograma-equipe.md` (horas dependem da captura;
  workload por contagem)
- `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` (Gestão como view; perguntar à
  VRZ/BM3 antes de decidir Gestão)
- `research/aec/monday-com-benchmark-2026.md` (por que o board flat configurável é armadilha)
- Painel de 2026-07-30 (produto/ICP/red-team) que recusou achatar o modelo — resumo na
  memória `project_modelo_flat_vs_hierarquico_2026-07-30`
