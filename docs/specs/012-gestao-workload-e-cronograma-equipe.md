# SPEC: Gestão — Workload e Cronograma da equipe (visão do gestor)

**Data:** 2026-07-30
**Status:** Rascunho (decisão D1 em aberto: fonte da carga)
**Autor:** Matheus Rezende
**Módulo:** gestao

## Problema

O dono/coordenador enxerga o próprio dia ("Meu trabalho", spec 008) e o cronograma
de um projeto por vez, mas **não enxerga a equipe como um todo**: quem está
sobrecarregado, quem está ocioso, o que cada pessoa tem na mão, e o que vai entrar
nas próximas semanas. Foi a dor literal do design partner ("estou toda hora
resolvendo o operacional, nunca consigo visualizar onde quero chegar", demo
2026-07-24).

Hoje três coisas travam essa visão:

1. **Workload existe mas está morto.** A tela Capacidade (`src/pages/capacidade/`)
   tem a grade pessoa × semana com % de alocação e contadores de sobrecarregado/
   ocioso, mas a query de alocações retorna `[]` de propósito (a tabela `alocacoes`
   foi removida — `009_timesheets_alocacoes.sql` → `20260429000001_drop_timesheets.sql`).
   A tela renderiza vazia. Além disso é `core: false` / `includedInPlans: ["enterprise"]`
   e **não está no menu de nenhum módulo** (`src/lib/modules.ts`): não há porta de entrada.
2. **O Gantt é por projeto, não por pessoa.** `CronogramaProjetosTab`
   (`src/pages/projetos/components/CronogramaProjetosTab.tsx`) já faz timeline com
   barras, zoom Meses/Semanas, linha "Hoje", filtro por responsável/cliente/status e
   marcação de atraso. Mas a linha é o projeto; não há a visão "uma faixa por pessoa".
3. **Não há previsão do que vai entrar.** O Cronograma exige `data_inicio` e
   `data_previsao` preenchidas (`CronogramaProjetosTab.tsx:205`); o pipeline
   (propostas/leads que ainda vão virar projeto) não aparece em lugar nenhum da
   timeline.

## Objetivo

Uma área de gestão da equipe (visível ao gestor/admin) com **três visões**:

- **Workload por pessoa:** a carga de cada funcionário num relance — o que tem em
  aberto, o que está atrasado, próxima entrega, e um sinal de sobrecarga/folga.
- **Gantt por funcionário:** o Cronograma existente com o eixo virado — uma faixa
  (swimlane) por pessoa, com os trabalhos dela distribuídos na timeline.
- **Previsão de pipeline:** projetos futuros (propostas/leads em aberto) plotados como
  barras previstas na mesma timeline, para antecipar o que vai entrar de trabalho.

Depois disso, o gestor abre o Pilar e vê a equipe inteira e o futuro próximo sem
precisar entrar projeto por projeto.

## Decisão em aberto — D1: fonte da carga (bater o martelo antes de codar)

A carga por pessoa pode ser medida de dois jeitos, com custo e confiabilidade muito
diferentes:

- **(a) Contagem de trabalho** — nº de disciplinas + tarefas abertas por pessoa,
  prazos e atrasos. Usa só o dado que **já existe** (`projeto_disciplinas.responsavel_id`
  - `tarefas`). Zero atrito de entrada, tela viva no dia 1. Menos preciso: mede
    quantidade de itens, não horas.
- **(b) Horas planejadas** — % de alocação por semana, como a tela Capacidade
  pressupõe. Mais preciso, mas **exige que alguém lance as horas planejadas toda
  semana**. Esse gesto de entrada é o mesmo atrito que já matou o timesheet duas vezes
  neste repositório. Sem quem alimente, a tela renasce vazia.

**Recomendação:** alvo é (b), entrega é faseada. **v1 = (a) contagem** (telas vivas
com dado real, sem atrito), com o schema projetado para **plugar (b) horas quando a
captura de horas existir** (o gate de captura de horas já previsto na sequência de 90
dias). As três telas migram de contagem para % sem reescrever a UI.

Se D1 fechar em (b) direto, esta spec cresce: precisa de uma tela de **planejamento de
alocação** (lançar horas por pessoa/semana/projeto) como pré-requisito, e a decisão de
reabrir a captura de horas vira **ADR** (é transversal: toca timesheet, pricing e o
gate de horas). O restante desta spec assume a recomendação (v1 por contagem).

## Fora de escopo (v1)

- **Captura de horas / timesheet real** (planejado vs realizado por lançamento). Esta
  spec projeta o encaixe, não o implementa.
- **Tela de planejamento/alocação de horas** (só entra se D1 = (b) direto).
- **Drag-and-drop para realocar** trabalho entre pessoas no Gantt.
- **Nivelamento automático de carga / sugestão de quem aloca** (IA). Não na v1.
- **Edição de datas de proposta a partir da previsão.** O pipeline é só leitura.

## O que já existe (aproveitar)

- **`src/pages/capacidade/index.tsx`**: grade pessoa × 12 semanas, `getCellColor`
  (faixas 0/≤80/80-100/>100%), contadores sobrecarregado/ocioso, navegação de semanas,
  `AlocacaoVsReal`. É o esqueleto do Workload; falta a fonte de dados e a plugagem.
- **`CronogramaProjetosTab`**: engine de timeline completa (colunas Meses/Semanas,
  `todayPct`, `generateColumns`, `leftPct`/`widthPct`, tooltip, filtros). O Gantt por
  funcionário reusa isso mudando o agrupamento de linhas.
- **`public.projeto_disciplinas`** (+ `projeto_disciplina_responsaveis`): trabalho
  derivado de projeto, com responsável, prazo (`data_fim`) e status.
- **`public.tarefas`** (spec 008): trabalho avulso com responsável, prazo, status.
- **`public.pessoas`** (`horas_semanais`, `cargo`): denominador da carga e faixas.
- **Propostas/Leads**: fonte do pipeline (projetos futuros).
- Padrões de RLS por `empresa_id`, `useToast`, early-return, `src/lib/rbac.ts`/`roles.ts`.

## Requisitos

Funcionais (numerados, testáveis):

1. Existe uma área de gestão da equipe no pilar Gestão, com as três visões (Workload,
   Gantt por funcionário, Previsão), navegável por abas ou sub-rotas. A aba ativa
   persiste e é deep-linkável.
2. A área só aparece no menu e é acessível para papel de gestão (coordenador/owner);
   colaborador não vê a visão agregada da equipe (RBAC via `src/lib/roles.ts`).
3. **Workload:** lista as pessoas da empresa com, por pessoa: nº de itens abertos
   (disciplinas + tarefas), nº atrasados, próxima entrega (data mais próxima), e um
   sinal de carga (baldes visuais reusando `getCellColor`). Ordenável por carga.
4. **Workload:** filtro por período (próximas N semanas) e clique numa pessoa leva ao
   detalhe do trabalho dela (reusa "Meu trabalho" filtrado por aquela pessoa).
5. **Gantt por funcionário:** timeline com uma faixa por pessoa; dentro da faixa, os
   trabalhos dela (disciplinas com data + tarefas com prazo) como barras. Mantém zoom
   Meses/Semanas, linha "Hoje" e marcação de atraso da engine atual.
6. **Gantt por funcionário:** filtro por pessoa e por status; clicar numa barra abre o
   item de origem (disciplina → projeto; tarefa → detalhe).
7. **Previsão:** propostas/leads em aberto com data estimada aparecem como barras
   "previstas" (estilo tracejado/distinto) na timeline, separadas do trabalho firmado.
   Item de pipeline sem data estimada é listado à parte (não some), como o Cronograma
   já faz com projeto sem datas.
8. Nenhuma tela exige a tabela `alocacoes` (morta). A carga vem de disciplinas+tarefas.

Não-funcionais:

- **Segurança / RLS:** toda leitura escopada a `empresa_id = get_user_empresa_id()`.
  Nenhum item de outra empresa aparece em nenhuma fonte (disciplinas, tarefas,
  propostas, leads, pessoas). RPCs de agregação seguem o padrão de escopo explícito.
- **Papéis:** a visão agregada da equipe é gated a coordenador/owner. Colaborador que
  acessar a rota direto recebe o mesmo tratamento de `RequireRole` do resto do app.
- **Performance:** agregação por pessoa filtra por `empresa_id` com índice; sem
  full-scan por pessoa. Preferir uma RPC que agrega no banco a N queries no cliente.
- **Multi-tenant:** testar com `auth.uid()` de duas empresas.

## Critérios de aceite

- [ ] Dado que sou coordenador/owner, quando abro a área de equipe, então vejo as três
      visões; dado que sou colaborador, então não vejo o item no menu nem acesso a rota.
- [ ] Workload: dado que a pessoa X tem 3 disciplinas e 2 tarefas abertas (1 atrasada),
      quando abro o Workload, então a linha de X mostra 5 abertos, 1 atrasado e a
      próxima entrega correta.
- [ ] Workload: dado que clico numa pessoa, então abro o trabalho dela (Meu trabalho
      filtrado por aquela pessoa).
- [ ] Gantt por funcionário: dado que X tem uma disciplina com data e uma tarefa com
      prazo, quando abro o Gantt, então ambas aparecem na faixa de X, na posição certa
      da timeline, e a atrasada vem marcada.
- [ ] Previsão: dado uma proposta em aberto com data estimada, então ela aparece como
      barra prevista (visual distinto do trabalho firmado); sem data estimada, é
      listada à parte, não some.
- [ ] Nenhuma tela consulta a tabela `alocacoes`.
- [ ] Multi-tenant: dado um usuário de outra empresa, então nenhuma pessoa, disciplina,
      tarefa ou proposta da minha empresa aparece pra ele.
- [ ] Borda: pessoa sem nenhum item aberto aparece no Workload como "sem carga" (não
      some, não quebra ordenação).

## Dados e contratos

Sem tabela nova na v1 (contagem). As visões consomem RPCs de agregação sobre fontes
existentes:

- **`get_workload_equipe(p_desde date default null, p_ate date default null)`** →
  uma linha por pessoa da empresa:
  `{ pessoa: { id, nome, cargo, horas_semanais }, abertos_disciplinas, abertos_tarefas,
atrasados, proxima_entrega (date|null), carga_bucket }`. Escopo
  `empresa_id = get_user_empresa_id()`. `carga_bucket` deriva de uma heurística de
  contagem (ex.: 0 itens = ocioso; > limiar = sobrecarregado) até existirem horas.
- **`get_gantt_equipe(p_pessoa_id uuid default null, p_status text default null)`** →
  itens plotáveis por pessoa:
  `{ pessoa_id, tipo: 'disciplina' | 'tarefa', item_id, titulo, inicio (date|null),
fim (date), status_bucket, projeto: { id, nome } | null }`. Une
  `projeto_disciplinas`(+responsáveis+`projetos`) e `tarefas`, escopo por empresa.
- **`get_pipeline_previsto()`** → propostas/leads em aberto com data estimada:
  `{ tipo: 'proposta' | 'lead', id, titulo, data_estimada (date|null), valor,
cliente_nome }`. Item sem `data_estimada` volta com `null` (a UI lista à parte).

Quando D1 evoluir para horas (gate de captura), estende-se `get_workload_equipe` com
`horas_planejadas`/`horas_realizadas` por semana, e `carga_bucket` passa a derivar de
`horas / horas_semanais` (reusando `getCellColor`), sem mudar o shape consumido pela UI
além dos campos novos.

## Plano de implementação

Fases ordenadas e verificáveis. Confirmar D1 antes de gerar código.

**Fase A — Leitura (RPCs de agregação)**

1. `get_workload_equipe`: agrega disciplinas+tarefas por pessoa, escopo por empresa,
   heurística de `carga_bucket`. _Verificação:_ pgTAP de escopo com dois `auth.uid()`.
2. `get_gantt_equipe` e `get_pipeline_previsto` (mesmo padrão de escopo).
3. `npm run gen:types` (staging, ADR 0007) e commitar `types.ts`.

**Fase B — Reativar e replugar a área** 4. `src/lib/features.ts`: revisar `capacidade` (ou nova `equipe_workload`) — `core`/
`includedInPlans` provisórios (D1 de pricing como na 008), gate de leitura por papel. 5. `src/lib/modules.ts`: item novo no pilar `gestao` (`adminOnly: true`), apontando
para a área de equipe. É a porta de entrada que hoje não existe. 6. Rota protegida com `RequireRole` (coordenador/owner) + `FeatureRoute`.

**Fase C — Workload** 7. Reaproveitar `src/pages/capacidade/` como a tela de Workload por contagem: trocar a
fonte morta pela `get_workload_equipe`; manter `getCellColor`/contadores; linha por
pessoa clicável → Meu trabalho filtrado.

**Fase D — Gantt por funcionário** 8. Extrair a engine de `CronogramaProjetosTab` (colunas/`todayPct`/posicionamento) para
um componente reutilizável de timeline; nova visão agrupa linhas por pessoa
consumindo `get_gantt_equipe`. Reusa zoom, "Hoje", atraso, tooltip.

**Fase E — Previsão de pipeline** 9. Camada de barras "previstas" (visual distinto) sobre a mesma timeline, consumindo
`get_pipeline_previsto`; itens sem data listados à parte.

**Fase F — Verificação (critérios de aceite)** 10. Vitest: RBAC (colaborador sem acesso), agregação de Workload, plotagem do Gantt por
pessoa, distinção pipeline previsto, RLS multi-tenant, borda pessoa sem carga.

## Decisões e riscos

- **Armadilha da tela vazia (o risco central).** Toda tela de carga baseada em horas
  planejadas morre sem quem alimente as horas. Mitigação: v1 por contagem (dado que já
  existe), horas só depois da captura de horas. Se D1 forçar horas já, o pré-requisito
  é uma tela de planejamento de alocação — e aí a spec e o custo dobram.
- **Reabrir horas é decisão transversal → ADR.** Se e quando for pra horas planejadas/
  realizadas, registrar ADR (context/decision/consequences): toca timesheet (removido
  2x), pricing e o gate de captura de horas.
- **Pipeline depende de datas de proposta que talvez não existam.** Propostas/leads sem
  data estimada não plotam; a previsão fica parcial até o dado melhorar. Aberto
  conscientemente (lista à parte, não inventa data).
- **Persona.** A visão de gestão da equipe serve o ICP (sócio de engenharia vendo a
  carga do time), não vira workspace genérico à la Monday (ver spec 008, mesma disciplina).

## Relacionados

- `docs/specs/008-gestao-meu-trabalho.md` (Meu trabalho — a visão pessoal que esta
  agrega; fonte `tarefas` + disciplinas)
- `docs/specs/009-calendario-google-like.md` e ADR 0010 (calendário compartilhado)
- `docs/strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md` (Gestão como view; gate de
  captura de horas na sequência de 90 dias)
- `src/pages/capacidade/` e `src/pages/projetos/components/CronogramaProjetosTab.tsx`
  (código a reaproveitar)
