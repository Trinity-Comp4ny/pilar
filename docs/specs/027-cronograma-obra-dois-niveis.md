# SPEC: Cronograma da obra em dois níveis (frente + passos)

**Data:** 2026-08-12
**Status:** Implementada e verificada no browser (local); pendente deploy staging/prod

## Rodada 2 (UX, após teste no browser)

Depois de exercitar o fluxo no navegador, ajustes que tornaram o cronograma
utilizável de verdade:

- **Nomenclatura:** "frente de serviço" → **etapa**, "passo/pendência" →
  **tarefa** em toda a UI de obras (cronograma, Visão, estoque). Só rótulo; o
  modelo segue `obra_frente` / `tarefas`.
- **Adicionar tarefa inline:** botão "+" na etapa e linha "+ tarefa" no próprio
  Gantt; digita o nome e Enter. A tarefa **herda o período da etapa** (nasce com
  barra) para o usuário ajustar por drag. Antes só dava para adicionar dentro do
  dialog, o que ninguém achava.
- **Drag nas barras:** arrastar bordas (redimensiona início/fim) e corpo (move),
  para etapa (grava `obra_frente`) e tarefa (grava `tarefas.data_inicio/prazo`),
  portando o mecanismo do cronograma de Projetos (`CronogramaTab`) com snap a
  mês/semana. Helpers `toIso`/`snapToBoundary` extraídos para `lib/cronograma.ts`.
  Ref `dragMovedRef` suprime o clique que o navegador dispara no fim do arraste
  (senão abria o dialog sem querer).
- **Datas por DatePicker custom** (`components/ui/date-picker`) no lugar do
  `<input type="date">` nativo, no dialog e no criar-etapa. Alinha com a regra de
  nunca usar controle nativo do SO.
- **Bug corrigido (fora do escopo, mas travava tudo):** a query `useObraTarefas`
  quebrava com `PGRST201` (embed ambíguo `responsavel:pessoas`) depois que a
  migration `tarefa_responsaveis` criou um 2º caminho tarefas↔pessoas. Nenhuma
  tarefa aparecia. Corrigido fixando a FK: `pessoas!tarefas_responsavel_id_fkey`.
  ⚠️ Quando a migration de multi-responsável for para staging/prod, qualquer
  query com `responsavel:pessoas` direto em `tarefas` quebra igual; "Meu trabalho"
  já usa a ponte e está a salvo.
  **Autor:** Matheus Rezende
  **Módulo:** obras
  **Estende:** [020 — Cronograma da obra](020-cronograma-da-obra.md)

## Problema

A spec 020 entregou o Gantt da obra por frente de serviço: cada frente
(fundação, alvenaria, instalações) é uma barra na linha do tempo, com estado e
percentual. Mas o trabalho real acontece nos **passos** dentro de cada frente
(ex.: dentro de fundação: limpeza do terreno, escavação, concretagem). Hoje
esses passos são as pendências da frente e só aparecem escondidos no detalhe da
frente, sem período nem barra. O sócio vê "a fundação vai de tal a tal", mas não
vê o encadeamento interno: o que já rolou, o que está em curso, o que atrasou
dentro da etapa.

Em Projetos ele tem os dois níveis: o cronograma de todos os projetos (uma barra
por projeto) e, ao entrar num projeto, o cronograma de disciplinas. Na obra ele
quer o mesmo, mas num Gantt só: a frente como linha-pai e os passos como
sub-barras abaixo, com a barra do "hoje" cortando tudo.

## Objetivo

O cronograma da obra passa a ser **hierárquico**: cada frente é uma linha-pai com
barra-resumo e um controle de expandir/recolher; expandida, mostra os passos como
sub-barras indentadas, cada uma com seu período (início → prazo), cor por estado e
a linha "Hoje" cruzando os dois níveis. Depois desta feature o usuário abre o
cronograma, expande "Fundação" e responde de bate-pronto "a limpeza do terreno já
acabou, a escavação está atrasada e a concretagem ainda não começou", sem abrir
dialog nenhum.

**Fora de escopo (mantém o da 020):**

- Visão calendário, curva-S / físico-financeiro, dependências entre passos.
- Arrastar a barra do passo para editar datas (drag). No MVP a data se edita por
  campo no detalhe da frente; drag fica para fase 2.
- Um terceiro nível abaixo do passo. A hierarquia é exatamente frente → passo.
- Datas realizadas do passo. O passo guarda início e prazo previstos; o
  "concluído" continua vindo do `status` da tarefa, não de data real.

## Requisitos

Funcionais:

1. O passo (tarefa da obra) ganha **data de início** (prevista), opcional. O
   prazo (`prazo`) já existe e passa a ser o **fim** da barra do passo.
2. Cada frente na coluna fixa ganha um controle **expandir/recolher** (chevron).
   Por padrão as frentes vêm **expandidas**, mostrando os passos de cara; o estado
   de expansão é por frente e vive só na sessão (não persiste).
3. Frente expandida mostra seus passos como **sub-linhas indentadas** sob ela, na
   ordem em que aparecem no detalhe da frente. A barra-resumo da frente continua
   visível na linha-pai.
4. A **barra do passo** cobre `data_inicio → prazo`. Passo com só uma das duas
   datas (ou nenhuma) **não vira barra**: aparece na sub-linha com o rótulo e uma
   marca "sem período", e conta no aviso de itens sem prazo da frente.
5. A **cor da barra do passo** reflete o estado derivado:
   - concluído (`status = concluida`) — verde, independente de data;
   - atrasado (hoje passou do prazo e não concluído) — vermelho, com aviso;
   - em andamento (hoje entre início e prazo) — azul;
   - futuro (início ainda não chegou) — cinza.
6. A **barra-resumo da frente** cobre a união do período próprio da frente
   (`data_inicio`/`data_fim` da frente, da spec 020) com o span dos passos com
   período (menor início, maior prazo). Assim a frente aparece na timeline se
   tiver datas próprias **ou** passos datados. Mantém o percentual concluído e a
   cor por estado da 020.
7. A **linha "Hoje"** cruza a linha-pai e as sub-linhas; zoom Meses/Semanas e o
   botão de rolar até hoje continuam valendo para o conjunto.
8. No **detalhe da frente** (dialog atual), cada passo ganha um campo de **data de
   início** ao lado do prazo, para preencher/editar. Validação: início não pode ser
   depois do prazo.
9. Frente **sem período nenhum** (nem própria nem por passos) continua no aviso
   "sem prazo definido", fora da timeline (comportamento da 020).

Não-funcionais:

- **Segurança / RLS:** a migration só **adiciona uma coluna** (`tarefas.data_inicio
date null`); `tarefas` já tem RLS por `empresa_id` e as policies de update/insert
  existentes cobrem a coluna nova. Sem tocar policy. Confirmar ausência de regressão
  de grant.
- **Multi-tenant:** nada de query nova cross-obra; tudo segue filtrando por
  `obra_id` via `useObraTarefas`.
- **Performance:** reusa `useObraFrentes(obraId)` e `useObraTarefas(obraId)` já
  carregados; a hierarquia e as posições das barras são computadas no front sobre
  esses dados, sem query por frente nem por passo.
- **Compartilhamento:** `tarefas` é a tabela usada também em "Meu trabalho". A
  coluna `data_inicio` é opcional e não altera nenhum fluxo existente lá; a UI de
  "Meu trabalho" não é obrigada a expô-la nesta spec.

## Critérios de aceite

- [ ] Dado que abro o cronograma de uma obra, então cada frente aparece com um
      controle de expandir/recolher e, por padrão, já expandida.
- [ ] Dada a frente "Fundação" com os passos limpeza (01→03/08), escavação
      (04→08/08) e concretagem (09→14/08), quando expando a frente, então vejo três
      sub-barras cobrindo exatamente esses períodos.
- [ ] Dado um passo concluído, quando vejo sua barra, então ela está verde mesmo
      que o prazo ainda não tenha chegado.
- [ ] Dado um passo com prazo vencido e não concluído, quando vejo sua barra, então
      ela está vermelha e sinalizada como atrasada.
- [ ] Dado um passo sem data de início ou sem prazo, quando expando a frente, então
      ele aparece como sub-linha sem barra, marcado "sem período".
- [ ] Dada uma frente sem datas próprias mas com passos datados, quando abro o
      cronograma, então a frente aparece na timeline com a barra-resumo cobrindo o
      span dos passos.
- [ ] Dado que recolho uma frente, então suas sub-linhas somem e só a barra-resumo
      permanece; ao reexpandir, as sub-barras voltam.
- [ ] Dado que estou no detalhe da frente, quando informo início e prazo de um
      passo e salvo, então a sub-barra dele aparece no cronograma no período certo.
- [ ] Caso de borda: ao salvar um passo com início depois do prazo, o sistema
      impede e explica o porquê.
- [ ] Dado que troco Meses↔Semanas, então colunas, barras-pai, sub-barras e a linha
      "Hoje" se ajustam juntas.
- [ ] Sem permissão de editar obra, o usuário vê a hierarquia e as sub-barras, mas
      não os campos de editar data do passo.

## Dados e contratos

Migration (`ALTER TABLE`, sem tabela nova):

- **`tarefas`**: adicionar `data_inicio date null`. Semântica na obra: início
  previsto do passo; o fim é o `prazo` existente. (Reuso de `prazo` como fim evita
  uma segunda coluna e casa com o que a UI já coleta.)

Front:

- `useObraTarefas` passa a devolver `data_inicio`; `useCreateObraTarefa` /
  `useUpdateObraTarefa` aceitam `data_inicio`.
- Funções puras novas em `src/lib/obras.ts`, com testes:
  - `estadoTarefaCronograma(tarefa, hoje)` → `concluida | atrasada | em_andamento
| futura | sem_periodo`.
  - `spanFrente(frente, tarefasDaFrente)` → `{ inicio, fim } | null`, unindo o
    período próprio da frente com o span dos passos datados.
- A matemática de timeline (`lib/cronograma.ts`) já é compartilhada e serve os dois
  níveis sem mudança de assinatura.
- `ObraCronogramaTab` passa a montar linhas em dois níveis (pai + filhos) e a
  guardar o conjunto de frentes expandidas em estado local.
- `FrenteDetailDialog` ganha o campo de início por passo.

## Plano de implementação

Aprovado antes de gerar código. Passos:

1. Migration `tarefas ADD COLUMN data_inicio date`; `npm run gen:types:local`
   (diff = só a coluna). Aplicação em staging/prod é passo posterior (ADR 0007).
2. `src/lib/obras.ts`: `estadoTarefaCronograma` e `spanFrente` + testes em
   `src/lib/obras.test.ts` cobrindo os estados e o span (frente só com passos,
   frente só com datas próprias, união).
3. Hooks `useObraTarefas` / create / update: incluir `data_inicio`.
4. `ObraCronogramaTab`: montar `rows` hierárquicas (frente-pai + passos quando
   expandida), estado `expandidas: Set<string>` (default: todas), chevron na coluna
   fixa, sub-linhas indentadas, sub-barras por passo com cor por estado; barra-resumo
   da frente passando a usar `spanFrente`. Linha "Hoje" e zoom já cobrem os dois níveis.
5. `FrenteDetailDialog`: campo de data de início por passo, com validação
   início ≤ prazo.
6. Testes dos critérios (funções puras + montagem das linhas). `npm run test:run`,
   `npm run typecheck`, `npm run lint`.
7. Verificação no browser (`dev:local`) com uma frente e passos datados.

## Decisões e riscos

- **`prazo` vira o fim do passo.** Reusar o campo que já existe em vez de criar
  `data_fim` na tarefa: menos schema, casa com a UI atual e com "Meu trabalho".
  Custo: o nome `prazo` fica com duplo sentido (fim no Gantt), documentado aqui.
- **Frentes expandidas por padrão.** Entrega o valor pedido ("quero ver os passos")
  já na abertura; quem quiser visão macro recolhe. Estado só na sessão, sem persistir.
- **Barra-resumo = união (frente ∪ passos).** Evita a frente sumir da timeline
  quando só os passos têm data, sem obrigar preencher datas na frente. Alternativa
  descartada: exigir datas próprias na frente (mais atrito).
- **Passo sem período não some.** Fica como sub-linha sem barra (não vira marcador),
  para não sugerir uma data que não existe; sinaliza o que falta preencher.
- **Sem ADR.** É o padrão de Gantt já estabelecido (020) estendido a um segundo
  nível; nenhuma decisão transversal nova.
- **Deploy (ADR 0007).** Migration só no banco local nesta entrega; `db:push` e o
  `gen:types` de staging/prod são passos explícitos depois.
