# SPEC: Criar tarefa pelo dia da Agenda e aba Tarefas dentro da obra

**Data:** 2026-10-26
**Status:** Aprovada (protótipo aprovado em 2026-10-26)
**Autor:** Matheus Rezende
**Módulo:** tarefas (Gestão) e obras
**Protótipo:** v1 no Claude Design (https://claude.ai/artifact/DJsn2S7LBvkspAKdVH265u), opção A da aba Tarefas
**Origem:** feedback da VRZ de 17/10/2026. Cards BEZ-348 (Agenda) e BEZ-349 (obra), filhos do BEZ-345.

## Problema

Quem planeja a semana pela Agenda de Tarefas só consegue ver prazos: para criar uma tarefa num dia
precisa sair da Agenda, abrir "Nova tarefa" e digitar a data. E as tarefas de uma obra ficam misturadas
com todas as outras em Gestão > Tarefas: a obra tem Cronograma (onde se planeja), mas não tem uma lista
de trabalho de quem faz o quê e até quando.

## Objetivo

1. Na Agenda, criar uma tarefa já com o prazo do dia em dois cliques e sem sair da tela.
2. Cada obra passa a ter a aba **Tarefas**, com a lista e o quadro só das tarefas dela.

**Fora de escopo:**

- Arrastar um evento da Agenda para outro dia (mudar prazo por arraste).
- Criar disciplina pela Agenda (só tarefa).
- Substituir o Cronograma: fase, etapa, serviço e Gantt continuam lá.
- Filtro Obra em Gestão > Tarefas (opção B do protótipo, descartada).

## Requisitos

### Agenda (BEZ-348)

1. Na visão Mês, cada dia do mês corrente ganha o botão **+** ao passar o mouse ou ao focar o dia
   por teclado. Dia passado também (registrar o que já foi feito).
2. O **+** abre um quadro curto: Nome (obrigatório), Responsável (padrão: a pessoa do usuário; só
   admin troca, como no formulário completo) e Projeto ou obra (opcional). Mostra "Prazo: dd mmm aaaa".
3. "Criar tarefa" grava a tarefa com `prazo` = o dia, na primeira coluna (A fazer), fecha o quadro e
   mostra a tarefa na célula. "Mais campos" abre o `TarefaDialog` completo com o prazo preenchido.
4. Sem nome, o quadro mostra "Dê um nome à tarefa para criar." e não fecha. Falha ao gravar mostra
   "Não deu para criar a tarefa. Tente de novo." e mantém o que foi digitado.
5. No celular a Agenda é a lista por dia: cada dia tem o botão **+ Tarefa** e o quadro sobe de baixo.
6. Só vale em Gestão > Tarefas > Agenda (escopo pessoal). O `/calendario` geral não muda.

### Aba Tarefas da obra (BEZ-349)

7. A tela da obra ganha a aba **Tarefas**, entre Cronograma e Cotações. Quem vê a obra vê a aba.
8. A aba mostra as tarefas com `obra_id` igual ao da obra, em **Lista** (padrão) e **Quadro**, com as
   mesmas colunas, edição inline, ordenação (Ordenar) e arraste de Gestão > Tarefas. Sem disciplinas.
   Filtros: Pessoa, Prazo e busca. A aba mostra as tarefas de todos (não só as minhas).
9. Embaixo do nome aparece o caminho Fase › Etapa › Serviço, quando a tarefa está num serviço.
10. **Nova tarefa** na aba já nasce na obra (`obra_id`). O formulário ganha o campo opcional
    **Serviço da obra** (lista de "Fase › Etapa › Serviço"). Sem serviço, a tarefa fica na obra, fora
    da árvore do Cronograma.
11. A tarefa continua aparecendo em Gestão > Tarefas para o responsável, com o caminho da obra. Editar
    ou concluir de um lado reflete no outro (é a mesma linha em `tarefas`).
12. Estados: carregando (`PageLoader`), vazio ("Esta obra ainda não tem tarefas" com **Nova tarefa** e
    **Montar no cronograma**), erro ("Não deu para carregar as tarefas desta obra. Tente de novo.").
    Concluídas aparecem no grupo Concluído, recolhido por padrão.

Requisitos não-funcionais:

- **Segurança / RLS:** nenhuma tabela nova. As policies de `tarefas` (empresa, e editar só
  admin, coordenador, criador ou responsável) já cobrem. A obra de outra empresa não aparece.
- **Performance:** a aba usa a mesma consulta de tarefas da Gestão e filtra por obra no cliente;
  obra de referência com 600 tarefas renderiza sem travar.
- **Validação na fronteira:** `obra_frente_id` precisa ser da mesma obra e não pode ser fase (trigger
  `tg_tarefa_obra_no_servico` já barra); o front só oferece serviços da obra.

## Critérios de aceite

- [ ] Dado a Agenda do mês, quando passo o mouse no dia 18 e clico em +, então abre o quadro "Nova
      tarefa em 18 de outubro" com o prazo 18 out 2026.
- [ ] Dado o quadro aberto, quando digito o nome e clico em Criar tarefa, então a tarefa existe com
      `prazo` = 18/10 na coluna A fazer e aparece na célula do dia 18 sem recarregar.
- [ ] Dado o quadro aberto sem nome, quando clico em Criar tarefa, então aparece o erro, o foco vai
      para o nome e nada é gravado.
- [ ] Dado um erro de gravação, então o aviso aparece e o quadro mantém o nome digitado.
- [ ] Dado um dia passado, então o + também aparece.
- [ ] Dado a tela da obra X, então existe a aba Tarefas e ela lista só as tarefas com `obra_id` = X.
- [ ] Dado a aba Tarefas, quando clico em Nova tarefa e salvo, então a tarefa tem `obra_id` = X e
      aparece na aba e em Gestão > Tarefas do responsável.
- [ ] Dado um serviço escolhido no formulário, então a tarefa aparece sob esse serviço no Cronograma
      e o caminho aparece embaixo do nome na aba.
- [ ] Dado uma obra sem tarefas, então a aba mostra o estado vazio com as duas ações.
- [ ] Dado uma tarefa concluída, então ela está no grupo Concluído, recolhido.
- [ ] Caso de borda: usuário sem permissão de editar a tarefa vê o detalhe em modo leitura (igual à Gestão).

## Dados e contratos

Sem migration. Mudanças de front:

- `TAREFA_SELECT` passa a trazer `obra_id` e `obra_frente_id`; `TarefaInput` aceita os dois.
- `TarefaDialog` aceita `servicosObra` (opcional): com ela, mostra o campo Serviço da obra. O seletor
  de projeto continua como está.
- O corpo de `pages/meu-trabalho/index.tsx` vira `TarefasWorkspace`, que recebe `obraId` opcional e a
  moldura (página ou aba); a página e a aba usam o mesmo componente.
- `MesView` e `AgendaView` ganham `onCriarNoDia?: (dia: Date) => void`; sem a prop, nada muda.

## Plano de implementação

1. Agenda: `onCriarNoDia` nas duas views, quadro `NovaTarefaNoDia`, ligação no `AbaAgenda`.
2. Extrair `TarefasWorkspace` do `index.tsx` sem mudar comportamento (testes e E2E existentes verdes).
3. Aba `ObraTarefasTab` com `obraId`, `servicosObra` e o botão Montar no cronograma.
4. Testes: unidade (quadro do dia, filtro por obra, criação com `obra_id`) e fluxo real no navegador.

## Decisões e riscos

- Decisão: aba na obra (opção A) em vez de só filtro, porque a VRZ pediu "uma aba tarefas por obra" e o
  filtro não dá à obra uma casa para o trabalho.
- Decisão: o + aparece em dia passado, para registrar o que já foi feito.
- Decisão: concluídas visíveis na aba, recolhidas.
- Risco: extrair `TarefasWorkspace` mexe em uma tela muito usada. Mitigação: extração sem mudança de
  comportamento, antes da aba, com a suíte e o E2E visual existentes como rede.
