# SPEC: Disciplinas no Cronograma agregado

**Data:** 2026-09-02
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** projetos

## Problema

No cronograma agregado (`/projetos/cronograma`) cada linha é um projeto inteiro; pra ver como as disciplinas dele se distribuem no tempo, o usuário precisa sair dali e abrir o projeto individual (aba Cronograma do `ProjectDetailDialog`, `CronogramaTab.tsx`). Quem acompanha vários projetos ao mesmo tempo (sócio, coordenador) perde a visão panorâmica toda vez que quer conferir uma disciplina específica.

## Objetivo

Expandir a linha de um projeto no cronograma agregado revela as disciplinas daquele projeto como sub-linhas, cada uma com sua própria barra no período `data_inicio`→`data_fim`, sem sair da tela agregada.

**Fora de escopo:**

- Arrastar a barra de uma disciplina pra mudar suas datas direto no agregado (o drag continua existindo só na barra do projeto, como já é hoje).
- Abrir o detalhe/comentários de uma disciplina a partir daqui (clique leva para o projeto, aba Cronograma, igual já acontece hoje pro clique na linha do projeto).
- Mudar a ordenação/agrupamento de disciplinas (segue a ordem que `useProjetoDisciplinas` retorna, por `created_at`).

## Requisitos

1. Cada linha de projeto na coluna fixa esquerda ganha um chevron clicável antes do código do projeto. Clicar expande/colapsa; múltiplos projetos podem estar expandidos ao mesmo tempo (o scroll interno do quadro, adicionado antes, já contém a altura extra).
2. Ao expandir um projeto pela primeira vez, busca as disciplinas via `useProjetoDisciplinas(projeto.id)` (lazy: só dispara a query quando a linha está expandida). Enquanto carrega, mostra um skeleton curto no lugar das sub-linhas.
3. Cada disciplina expandida vira uma sub-linha, indentada, abaixo do projeto: nome da disciplina na coluna esquerda (com o código da disciplina se houver) e uma barra na timeline no período `data_inicio`→`data_fim`, na mesma escala de tempo (meses/semanas) já usada pro projeto. Sub-linha mais baixa que a do projeto (ex. `h-10` vs `h-14`) pra diferenciar visualmente.
4. Cor da barra da disciplina segue o mesmo mapeamento de status já usado em `CronogramaTab.tsx` (do detalhe do projeto individual), não o `PROJECT_STATUS_CONFIG` (que é só de projeto).
5. Disciplina sem `data_inicio` ou sem `data_fim`: sub-linha aparece sem barra, com um texto "sem datas" no lugar (mesmo espírito do aviso que já existe pra projeto sem datas).
6. Colapsar o projeto remove as sub-linhas da tela (não precisa descartar o cache da query — `useProjetoDisciplinas` já tem `staleTime` de 2min, reabrir é instantâneo).
7. Clique numa sub-linha (nome ou barra) navega para `/projetos/{id}#cronograma`, igual ao clique na linha do projeto — não abre nada específico da disciplina.
8. Estado de quais projetos estão expandidos é local ao componente (`useState`), não persiste entre sessões/reloads.

Requisitos não-funcionais:

- **Performance:** nenhuma query de disciplinas dispara para projetos que nunca foram expandidos (lazy por linha, não pré-carrega tudo).
- **Multi-tenant:** `useProjetoDisciplinas` já filtra por `projeto_id` sob RLS existente; nada novo aqui.

## Critérios de aceite

- [ ] Dado um projeto com 3 disciplinas com datas, quando clico no chevron da linha dele, então aparecem 3 sub-linhas com barras no período correto e o chevron vira "expandido".
- [ ] Dado o mesmo projeto expandido, quando clico no chevron de novo, então as sub-linhas somem e o layout volta ao tamanho original.
- [ ] Dado dois projetos diferentes, quando expando os dois, então ambos mostram suas disciplinas simultaneamente sem fechar um ao abrir o outro.
- [ ] Dado um projeto com uma disciplina sem `data_fim`, quando expando, então essa disciplina aparece na lista com "sem datas" e sem barra, sem quebrar as outras.
- [ ] Dado um projeto ainda não expandido, quando a tela carrega, então nenhuma chamada de rede para disciplinas daquele projeto acontece (verificável pelo Network do browser).
- [ ] Dado um projeto expandido com disciplinas carregadas, quando clico na barra de uma disciplina, então navego para `/projetos/{id}#cronograma`.

## Dados e contratos

Nenhuma tabela/coluna nova. Reusa `useProjetoDisciplinas(projetoId)` (`src/hooks/useProjetoDisciplinas.ts:80`), que já retorna `ProjetoDisciplinaDB[]` com `data_inicio`/`data_fim`/`status`. Reusa a função de geometria de barra (`getBarGeometry`/cálculo de posição por coluna) já usada em `CronogramaProjetosTab.tsx`, generalizada para aceitar `{start, end}` de disciplina em vez de só projeto.

## Plano de implementação

1. Extrair o cálculo de cor por status de disciplina de `CronogramaTab.tsx` para um lugar compartilhado (`src/lib/cronograma.ts` ou export do próprio arquivo), se ainda não estiver isolado.
2. Em `CronogramaProjetosTab.tsx`: adicionar estado `expandedIds: Set<string>` e o chevron na linha do projeto.
3. Renderizar sub-linhas condicionalmente (coluna esquerda + timeline) quando `expandedIds.has(projeto.id)`, usando `useProjetoDisciplinas` por projeto expandido (um hook call por linha expandida, via componente filho `DisciplinaRow` para não violar regra de hooks condicionais).
4. Skeleton de carregamento enquanto a query da disciplina está `isLoading`.
5. Testar com projeto de várias disciplinas (algumas sem data) no ambiente local.

## Decisões e riscos

- Decisão: permitir múltiplas linhas expandidas ao mesmo tempo (não é accordion de expansão única) — o scroll interno do quadro (já contido) absorve a altura extra, e forçar fechamento de outras linhas ao abrir uma nova seria uma limitação sem necessidade real.
- Risco: se um projeto tiver muitas disciplinas (>20), a linha expandida pode dominar a tela; sem paginação nesta v1, reavaliar se aparecer na prática.
