# SPEC 118: Tarefas visíveis para toda a empresa

**Data:** 2026-10-14  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** tarefas (Meu trabalho)

## Problema

Tarefa criada sem responsável não aparecia em lista, quadro nem agenda: o filtro
padrão era "Eu" e só enxergava tarefa com linha em `tarefa_responsaveis` para a
pessoa. Admin sem pessoa vinculada via tudo vazio. Usuário comum só lia o que
criou ou era responsável, então não dava para olhar o quadro da equipe.

## Objetivo

Qualquer pessoa da empresa vê as tarefas de todos, como no Trello e no ClickUp,
e filtra por pessoa ("meu modo") ou deixa o filtro vazio para ver tudo.

**Fora de escopo:** mudar quem edita ou exclui tarefa; disciplinas de projeto
(`get_minhas_disciplinas` segue devolvendo só as do usuário quando não há filtro).

## Requisitos

1. `tarefas_select` libera toda tarefa da própria empresa (`empresa_id = get_user_empresa_id()`).
2. O filtro de pessoa aparece para todos. Sem ninguém marcado, a lista mostra todas as
   tarefas, inclusive as sem responsável. "Eu" mostra só as da própria pessoa.
3. Editar, mover, mudar campo e excluir seguem com admin/ultra_admin, coordenador, criador
   e responsáveis (RLS de UPDATE/DELETE inalterada). Para os demais, o dialog abre em
   somente leitura e as ações inline avisam "Só quem é responsável pode alterar esta tarefa."
4. Isolamento por empresa mantido. Portal do cliente e Campo não mudam (acessam por RPC com token).

## Critérios de aceite

- [ ] Dado um usuário comum, quando abre Tarefas sem filtro, então vê tarefa de outro e tarefa sem responsável.
- [ ] Dado um usuário comum, quando marca "Eu", então vê só as tarefas em que é responsável.
- [ ] Dado admin que cria tarefa sem responsável, quando salva, então ela aparece na lista e no quadro.
- [ ] Dado um usuário comum, quando tenta mover ou excluir tarefa de outro, então nada muda e aparece o aviso.
- [ ] Dado um usuário de outra empresa, então nunca vê estas tarefas (pgTAP `tarefas_select_empresa_inteira.sql`).

## Plano de implementação

- Migration `20261029000000_tarefas_select_empresa_inteira.sql`: recria só `tarefas_select`.
- `resolverPessoaIds` (`filtroPessoas.ts`): sem filtro = `null` para todos.
- `meu-trabalho/index.tsx`: filtro para todos, guarda `bloqueado` nos handlers, `readOnly` no dialog.
- `created_by` entra no select de tarefas para decidir quem edita.
