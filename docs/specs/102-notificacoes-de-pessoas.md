# SPEC: Notificações de pessoas (responsável, etapa liberada, tarefa)

**Data:** 2026-10-06
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** notificações / projetos / meu-trabalho / obras
**Depende de:** [ADR 0015](../architecture/adr/0015-notificacoes-por-destinatario.md), [SPEC 029](029-central-de-notificacoes.md), [SPEC 089](089-notificacao-de-mencao.md), [SPEC 091](091-notificacoes-alinhadas-por-papel.md)

<!-- Origem: VRZ (06/10). Larissa foi colocada como responsável de dez disciplinas de
Detalhamento num dia e não recebeu nada. O sino dela tinha 67 de 68 notificações financeiras
(bug de roteamento corrigido no PR #511). O Flávio precisou escrever "@Larissa liberado para
detalhamento" à mão para avisar que a vez dela tinha chegado. Levantamento:
- `disciplina_atribuida` foi removida em 20260894000000 por 0% de leitura. Essa leitura foi
  medida com o sino afogado em alerta financeiro para todo membro comum, então não prova que o
  aviso é inútil.
- `proxima_etapa_liberada` existe, mas só dispara de `useProjetoDetail.applyDiscStatusChange`.
  Concluir pelo modal de /projetos, pelo quadro de tarefas ou pelo fluxo não avisa ninguém.
  Na VRZ, 0 notificações desse tipo em produção.
- Tarefa de obra grava só `tarefas.responsavel_id` e nunca passa pela ponte
  `tarefa_responsaveis`, onde vive o único trigger de `tarefa_atribuida`.
- Menção ao criar uma tarefa não notifica (o dialog não recebe o id novo). -->

## Problema

O trabalho num escritório de engenharia passa de mão em mão: o projetista conclui a etapa e o
detalhamento começa. Hoje o Pilar não avisa quem recebe a vez, nem quem foi colocado como
responsável. A passagem depende de alguém lembrar de mandar mensagem.

## Objetivo

Toda ação que coloca trabalho no colo de uma pessoa gera notificação para ela, venha de
qualquer tela: virar responsável de disciplina ou tarefa, e ter a etapa liberada porque a
anterior foi concluída.

**Fora de escopo:**

- **Mudança de status de projeto** (`projeto_status_alterado`). Continua removida: avisa sobre
  arrasto no Kanban, sem trabalho novo para ninguém.
- **Mudança de prazo ou de status intermediário** da disciplina (Em andamento, Em revisão).
- **Agrupar avisos** ("você virou responsável em 6 disciplinas do projeto X"). Um aviso por
  disciplina; agrupar fica para depois se o volume incomodar.
- **Link direto para a conversa** e perfil da pessoa: [SPEC 103](103-conversa-no-lugar-certo.md).

## Requisitos

1. **Responsável de disciplina.** Ao entrar uma pessoa com conta como responsável de uma
   disciplina, ela recebe `disciplina_atribuida`, exceto se foi ela mesma que se marcou ou se a
   disciplina já está concluída. A mensagem diz se ela já pode começar ou se espera a etapa
   anterior. Liberada = fora do fluxo (`ordem_etapa` nula), primeira etapa, ou todas as
   disciplinas da etapa anterior concluídas.
   - Liberada: severidade `medium`, "Já pode começar".
   - Esperando: severidade `low`, "Começa quando a etapa anterior for concluída".
   - Uma vez por pessoa e disciplina (não renotifica em reedição).
2. **Etapa liberada.** Quando uma disciplina muda para `Concluído` e com isso toda a etapa dela
   fica concluída, os responsáveis das disciplinas da etapa seguinte e a gestão operacional
   recebem `proxima_etapa_liberada`, com o nome de quem concluiu. Dispara no banco (trigger),
   então vale para qualquer tela. Quem concluiu não recebe.
3. **Tarefa atribuída por qualquer caminho.** Gravar ou trocar `tarefas.responsavel_id` (tarefa
   de obra, quadro de tarefas) notifica o novo responsável com `tarefa_atribuida`, com a mesma
   regra de unicidade da ponte `tarefa_responsaveis`: sem aviso duplicado quando os dois
   caminhos rodam na mesma criação.
4. **Menção ao criar tarefa.** Comentário com @ escrito antes do primeiro Salvar notifica
   depois que a tarefa é criada.
5. **Links** levam ao item, não só à tela: disciplina abre a disciplina no projeto
   (`/projetos/:id?disciplina=:id`), tarefa abre a tarefa (`/gestao/tarefas?tarefa=:id`),
   tarefa de obra abre a obra (`/obras/:id`). A abertura pelo parâmetro é da SPEC 103.

Não-funcionais:

- **Segurança:** funções `SECURITY DEFINER` com `REVOKE ALL FROM PUBLIC`; triggers resolvem
  `empresa_id` pelo próprio registro, nunca pelo cliente. Nenhuma policy nova.
- **Compatibilidade:** `rpc_notificar_proxima_etapa` continua existindo (bundle antigo ainda
  chama); o dedup do `notificar()` evita aviso duplo enquanto o bundle velho circula.
- **Preferência:** tudo respeita `notificacao_preferencias` (categorias `disciplina`/`tarefa`).

## Critérios de aceite

- [ ] Dado um admin que marca a Larissa numa disciplina da primeira etapa, então ela recebe
      `disciplina_atribuida` "Já pode começar", com link `?disciplina=`.
- [ ] Dado o mesmo numa disciplina da etapa 3 com a etapa 2 em aberto, então ela recebe o
      aviso com severidade `low` dizendo que espera a etapa anterior.
- [ ] Dado que a pessoa se marca sozinha, então nada é criado.
- [ ] Dado uma etapa com duas disciplinas paralelas, quando só uma conclui, então ninguém da
      etapa seguinte é avisado; quando a segunda conclui, os responsáveis da seguinte e a
      gestão operacional recebem `proxima_etapa_liberada`, menos quem concluiu.
- [ ] Dado uma disciplina concluída por qualquer tela (update direto na tabela), então o aviso
      de etapa liberada sai do mesmo jeito.
- [ ] Dado uma tarefa de obra criada com `responsavel_id`, então o responsável recebe
      `tarefa_atribuida` com link `/obras/:id`; dada uma tarefa criada no quadro (que grava
      `responsavel_id` e a ponte), então sai um aviso só.
- [ ] Dado um comentário com @ escrito numa tarefa nova, quando ela é salva, então o mencionado
      é notificado.

## Dados e contratos

Migration `20261009000000_notificacoes_de_pessoas.sql` (só funções e triggers, sem coluna):

- `_disciplina_liberada(p_disciplina uuid) → boolean`.
- `tg_notificar_disciplina_atribuida` + trigger `AFTER INSERT ON projeto_disciplina_responsaveis`.
- `_notificar_proxima_etapa(p_disciplina uuid, p_ator uuid) → integer`, chamada pelo trigger
  `trg_notificar_etapa_liberada` (`AFTER UPDATE OF status ON projeto_disciplinas`) e pela
  `rpc_notificar_proxima_etapa` (mantida, agora só valida empresa e delega).
- `_notificar_tarefa_atribuida(p_tarefa uuid, p_pessoa uuid) → void`, usada pelo trigger da
  ponte e pelo novo `trg_notificar_tarefa_responsavel` (`AFTER INSERT OR UPDATE OF
responsavel_id ON tarefas`).

Front:

- `useTarefaMutations().criar` devolve o id; `TarefaDialog.onSave` recebe o id e notifica as
  menções pendentes também na criação.
- `useProjetoDetail.applyDiscStatusChange` deixa de chamar a RPC (o trigger cobre).

## Plano de implementação

1. Migration com as funções e triggers acima.
2. pgTAP `supabase/tests/notificacoes_de_pessoas.sql` cobrindo os critérios.
3. Front: retorno do id na criação de tarefa, menção na criação, remover a chamada da RPC.
4. `gen:types` (funções novas internas não entram no client; conferir que `types.ts` não muda
   além do esperado), typecheck, vitest, PR para `staging`.

## Decisões e riscos

- **Volta do `disciplina_atribuida`.** A remoção de 20260894000000 mediu leitura num sino
  dominado por alerta financeiro indevido (corrigido no PR #511). Decisão do CEO em 06/10:
  volta. A diferença "já pode começar" vs "espera a etapa anterior" (com severidade menor) é o
  que separa aviso útil de ruído quando um fluxo inteiro é aplicado de uma vez.
- **Trigger em vez de RPC chamada pelo front** para etapa liberada: o status muda por pelo menos
  quatro telas; RPC no front já deixou de ser chamada em três delas.
- **Risco:** aplicar um fluxo com 8 disciplinas gera até 8 avisos por pessoa. Aceito nesta
  versão; os de etapas futuras chegam como `low`.
