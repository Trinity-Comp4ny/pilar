# SPEC: Pausar projeto e disciplina congela os prazos

**Data:** 2026-10-28
**Status:** Em implementação (protótipo v1 aprovado em 2026-10-28)
**Autor:** Matheus Rezende
**Módulo:** projetos, início, portal
**Protótipo:** v1 no Claude Design (https://claude.ai/artifact/C82VLpMRj6sdKs2BzGtmow), desktop e mobile, aprovado
**Origem:** pedido do Matheus em 28/10/2026. Card BEZ-399 (https://app.clickup.com/t/1dfhfaq824u). Estende a SPEC 084 (pausa por disciplina).

## Problema

O cliente pausa a obra e os prazos continuam correndo. O projeto aparece atrasado, as disciplinas
aparecem em "Vence nos próximos 15 dias" e na carga da equipe como atrasadas, e o /inicio fica
cheio de prazo velho de coisa que ninguém pode tocar. Quem gere o escritório perde o sinal: não
distingue o atraso real do trabalho parado a pedido do cliente.

Hoje a disciplina tem pausa (motivo, histórico), mas ela só desconta o atraso de disciplina já
concluída. O projeto não tem pausa: só o status `Paralisado`, sem motivo, sem histórico, sem retomada.

## Objetivo

Pausar um projeto ou uma disciplina congela os prazos: enquanto pausado, nada dali aparece como
atrasado nem como vencendo; ao retomar, os prazos andam pelos dias parados.

**Fora de escopo:**

- Obras (módulo `obras` tem `paralisada` próprio). Fica para um card de seguimento.
- Pausar pelo portal do cliente (o cliente pede, o escritório pausa).
- Pausa programada com data de retorno (retomada é sempre manual).
- Reordenar disciplinas sucessoras por dependência quando só UMA disciplina pausa (ver riscos).

## Requisitos

1. **Pausar projeto.** Botão **Pausar projeto** na tela do projeto, com motivo obrigatório. Cria o
   registro de pausa, põe o projeto em `Paralisado` e pausa todas as disciplinas abertas dele.
2. **Retomar projeto.** Botão **Retomar projeto** fecha a pausa e devolve o projeto e as disciplinas
   ao status de antes. Só retoma as disciplinas que a pausa do projeto pausou; a que já estava
   pausada à parte continua pausada.
3. **Pausar e retomar disciplina** continuam como na SPEC 084. Retomar passa a empurrar o prazo.
4. **Prazo anda ao retomar.** `data_fim` de cada disciplina retomada avança pelos dias parados
   (dia do calendário: `retomado_em::date - pausado_em::date`). `data_inicio` avança só se a
   disciplina ainda não tinha começado. Na retomada do projeto, `data_previsao` avança pelo mesmo número de dias.
5. **Congela no início.** Disciplina pausada ou de projeto `Paralisado` não entra em: "Vence nos
   próximos 15 dias", carga da equipe (`atrasada` e `emDia`), contagem de atrasados do projeto,
   tarefa atrasada e prazos da semana do resumo semanal.
6. **Congela fora do início.** Mesma regra na Agenda, nos alertas de prazo (notificações) e nos
   agentes proativos. Varredura obrigatória (critério de aceite 7).
7. **Mostra Pausado.** Lista, Kanban, cronograma e portal do cliente mostram **Pausado** em vez
   de atraso. O portal não mostra o motivo (é interno).
8. **Histórico.** Aba Histórico do projeto lista pausas e retomadas do projeto e das disciplinas
   (motivo, quem, quando, dias parados), já alimentada por `v_projeto_timeline`.
9. **Um estado só.** `Paralisado` passa a significar "pausado": não há mais caminho para ele sem
   motivo. Mover o card para a coluna Paralisado no Kanban abre o diálogo de motivo.

Requisitos não-funcionais:

- **Segurança / RLS:** tabela `projeto_pausas` com RLS por `empresa_id` via `projetos`; escrita só
  pelas RPCs (`SECURITY DEFINER`, `search_path = public`), `REVOKE` de `PUBLIC`, `GRANT` a `authenticated`.
  Mesma permissão de editar projeto (a da SPEC 084 só checa a empresa; fechar essa brecha junto).
- **Multi-tenant:** a RPC rejeita projeto de outra empresa.
- **Performance:** pausar/retomar projeto é uma transação com `UPDATE` em lote, sem laço por linha.
- **Consistência:** pausar e retomar são idempotentes contra clique duplo (índice único parcial, como na 084).

## Critérios de aceite

- [ ] Dado projeto `Em execução` com 3 disciplinas abertas e 1 concluída, quando pauso o projeto com
      motivo, então projeto fica `Paralisado`, as 3 abertas ficam `Pausada` e a concluída não muda.
- [ ] Dado pausa sem motivo (vazio ou só espaços), então a RPC recusa e nada muda.
- [ ] Dado projeto pausado há 20 dias, quando retomo, então `data_fim` das disciplinas retomadas e
      `data_previsao` avançam 20 dias, e os status voltam aos de antes.
- [ ] Dado disciplina pausada à parte e depois projeto pausado e retomado, então a disciplina
      continua `Pausada` e o prazo dela não avança pela pausa do projeto.
- [ ] Dado disciplina com `data_fim` vencida e pausada, então ela some de "Vence nos próximos 15
      dias" e de `atrasada` na carga; ao retomar, aparece com o prazo já empurrado (não atrasada).
- [ ] Dado projeto `Paralisado` com `data_previsao` vencida, então não conta em `atrasados`.
- [ ] Varredura (teste): nenhuma função SQL de alerta, painel, resumo ou agente lê `data_fim` /
      `data_previsao` / `tarefas.prazo` para atraso sem excluir pausa (lista fechada no PR).
- [ ] Caso de borda: pausar e retomar no mesmo dia desloca 0 dias.
- [ ] Caso de borda: retomar projeto sem pausa aberta devolve erro claro, sem alterar nada.
- [ ] Caso de borda: usuário de outra empresa chama a RPC e recebe "sem permissão".
- [ ] pgTAP com o papel `authenticated` (superuser não aplica RLS, ver memória do repo).
- [ ] Portal: projeto pausado mostra **Pausado**, sem motivo e sem selo de atraso.

## Dados e contratos

Migration nova (+ `npm run gen:types:local` e commit do `types.ts`):

- `projeto_pausas`: `id`, `projeto_id` (FK, cascade), `motivo` (not null), `status_anterior` (text),
  `pausado_em`, `pausado_por`, `retomado_em`, `retomado_por`, `created_at`. Índice único parcial
  de 1 pausa aberta por projeto (`WHERE retomado_em IS NULL`).
- `projeto_disciplina_pausas`: + `status_anterior text`, + `projeto_pausa_id uuid NULL` (FK
  `projeto_pausas`), para a retomada do projeto saber quais disciplinas são dela.
- `pilar_status_bucket`: `Pausada` deixa de cair em `a_fazer` e vira bucket próprio `pausada`
  (hoje cai em `a_fazer` por exclusão, o que a mantém nas listas).
- RPCs: `rpc_pausar_projeto(p_projeto_id uuid, p_motivo text) returns uuid` e
  `rpc_retomar_projeto(p_projeto_id uuid) returns void`; `rpc_retomar_disciplina` passa a empurrar o prazo.
- Recriar `get_painel_gestao`, `get_resumo_semanal_fatos` e as funções de alerta ambient com o filtro de pausa.
- Front: `useProjetoPausas` (mesmo molde de `useDisciplinaPausas`); `PausarDialog` único, usado por
  projeto e disciplina; `StatusBadge` ganha o tom de pausado (token `--status-paused` já existe).

## Plano de implementação

1. Protótipo no Claude Design: botão e diálogo de pausa, tela de projeto pausado, linha de
   disciplina pausada, /inicio sem os prazos, retomada com aviso do deslocamento. Desktop e mobile,
   estados vazio, carregando, erro e cheio. **Aprovação do Matheus antes do passo 2.**
2. Migration: tabelas, colunas, bucket, RPCs, pgTAP (com `authenticated`).
3. Funções do início, resumo semanal e alertas com o filtro de pausa; teste de varredura.
4. Front: botões, diálogo único, badges, Kanban com diálogo ao soltar em Paralisado.
5. Portal e edge function `portal-get-projeto` (expõe `pausado`, nunca o motivo).
6. Verificar: `typecheck`, `test:run`, pgTAP, fluxo real no dev local (`dev@local.test`) com print.

## Decisões e riscos

- **Decidido (28/10):** prazo empurra pelos dias parados ao retomar; `Paralisado` e pausa viram um
  estado só (reaproveita o valor do enum, sem `ALTER TYPE`).
- **Risco, dependência entre disciplinas:** pausar UMA disciplina e retomá-la empurra só o prazo
  dela; as sucessoras (`fluxoCascata`) não andam sozinhas. Mitigação: aviso na retomada listando as
  sucessoras e botão para aplicar a cascata. Na pausa do projeto o problema não existe (tudo anda junto).
- **Risco, histórico:** disciplinas pausadas antes desta spec não têm `status_anterior`. Retomar usa
  `Em Andamento` nesses casos (comportamento atual da 084).
- **Risco, tarefas:** tarefas do projeto pausado saem das contagens de atraso, mas o `prazo` delas
  não é deslocado (é próprio da tarefa). Reavaliar se virar queixa.
- **Risco, `Paralisado` legado:** projetos já `Paralisado` não têm registro de pausa. A migration
  cria uma pausa aberta com motivo "Paralisado antes do registro de pausas" e `pausado_em` = última
  mudança de status conhecida; Matheus confirma a data de início da pausa caso a caso.
- Sem ADR novo: segue o padrão da SPEC 084.
