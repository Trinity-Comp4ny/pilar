# SPEC: Notificação ao mencionar alguém com @

**Data:** 2026-09-02
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos / meu-trabalho / notificações

<!-- Origem: usuário reportou (via screenshot do modal de Projeto) que marcar alguém com @ num
comentário não gera nenhuma notificação, e perguntou se deveria. Levantamento no código confirmou:
`AtividadeComposer` (usado em `ProjetoAtividadesPanel`, `DisciplinaDetailDialog` e `TarefaDialog`)
já captura o array `mencionados` (ids de `pessoas`) e salva junto do comentário no jsonb
(`projetos.comentarios`, `projeto_disciplinas.comentarios`, `tarefas.comentarios`), mas nada lê
esse array pra criar linha em `notificacoes`. Central de notificações (spec 029) já tem a função
`public.notificar(...)` e o padrão de RPC chamada pelo front logo após salvar (ver
`rpc_notificar_projeto_status` em `20260848000000_notificacao_projeto_disciplina.sql`) — mesma
receita se aplica aqui. -->

## Problema

Mencionar alguém com `@` num comentário (projeto, disciplina ou tarefa) não avisa a pessoa de
forma nenhuma — ela só descobre se abrir aquela tela por conta própria. Isso quebra a expectativa
de quem usa `@` justamente pra chamar atenção de alguém específico.

## Objetivo

Ser mencionado com `@` num comentário (projeto, disciplina de projeto ou tarefa) gera uma
notificação in-app pro mencionado, com link direto pro item comentado.

**Fora de escopo:**

- **Notificar por outro canal (email, push).** Central de notificações hoje é só in-app; manter
  assim, sem abrir uma segunda frente de entrega.
- **Menção no chat de Agentes (`/agentes`).** É outra superfície de comentário, sem `pessoas`
  como destinatário possível hoje; fora deste ciclo.
- **Editar/apagar notificação quando o comentário é editado/apagado.** Comentários hoje não têm
  edição pós-envio; sem esse caso, sem essa regra.
- **Menção de quem não tem conta (`pessoas.profile_id IS NULL`).** Sem conta, sem inbox pra cair —
  mesma regra já usada em `tg_notificar_disciplina_atribuida`.

## Requisitos

Funcionais:

1. Ao salvar um comentário com `mencionados` não vazio (projeto, disciplina ou tarefa), o sistema
   cria uma notificação pra cada pessoa mencionada que tenha `profile_id` e não seja o próprio
   autor do comentário.
2. A notificação usa o texto do comentário (truncado) como mensagem, o nome do autor no título, e
   linka pra tela onde o comentário vive (projeto, disciplina ou tarefa).
3. Mencionar a mesma pessoa duas vezes no mesmo comentário gera só uma notificação (dedup por
   `mencionados` já é `Set`-like no front; RPC recebe a lista já sem duplicata).
4. Ícone do sino e badge de não lidas (já existentes, `useNotificacoesNaoLidas`) refletem a nova
   notificação sem ação extra do usuário — via Realtime já assinado.

Não-funcionais:

- **Segurança / RLS:** `SECURITY DEFINER`, checa `empresa_id` do registro comentado bate com
  `get_user_empresa_id()` antes de notificar (mesmo padrão de `rpc_notificar_projeto_status`).
  Nenhuma policy nova em `notificacoes` (já existe, spec 029).
- **Multi-tenant:** notificação nasce com o `empresa_id` do projeto/tarefa, nunca cross-empresa.
- **Dedup vem de graça do `public.notificar()` central:** ele já ignora uma nova notificação se
  existir uma não lida com mesmo `destinatario_id` + `tipo` + `referencia_id`. Logo, mencionar a
  mesma pessoa duas vezes no mesmo comentário (`referencia_id` igual) gera só uma linha; mencionar
  de novo na mesma entidade antes de ela ler a primeira também não empilha (mesmo comportamento já
  usado por `tarefa_atribuida`/`disciplina_atribuida`) — assim que ela lê, a próxima menção volta a
  notificar.

## Critérios de aceite

- [ ] Dado um comentário em Atividades do projeto mencionando uma pessoa com conta, quando o
      comentário é enviado, então essa pessoa recebe uma notificação com link pro projeto.
- [ ] Dado o mesmo cenário numa disciplina, então a notificação linka pra disciplina (mesma URL
      que `disciplina_atribuida` já usa: `/projetos/:projetoId` com a disciplina selecionada).
- [ ] Dado o mesmo cenário numa tarefa (Meu trabalho), então a notificação linka pra tarefa.
- [ ] Dado que o autor se automenciona, então nenhuma notificação é criada pra ele mesmo.
- [ ] Dado que a pessoa mencionada não tem `profile_id` (sem conta), então nenhuma notificação
      quebra o fluxo nem é criada.
- [ ] Caso de borda: comentário sem menção nenhuma não chama a RPC (sem custo extra no caminho
      comum).

## Dados e contratos

- Sem migration de schema (nenhuma coluna nova); só função nova.
- Nova RPC `public.rpc_notificar_mencao(p_entidade_tipo text, p_entidade_id uuid, p_mencionados
uuid[], p_preview text)`, `p_entidade_tipo IN ('projeto', 'disciplina', 'tarefa')`, resolve
  `empresa_id`/nome/link por tipo (3 ramos internos, cada um já teve a query equivalente escrita
  nos triggers existentes), traduz `pessoas.id` → `pessoas.profile_id` via join, chama
  `public.notificar(...)` por destinatário válido.
- Front: `ProjetoAtividadesPanel.adicionar`, `DisciplinaDetailDialog.adicionarComentario` e
  `TarefaDialog` (onSubmit do `AtividadeComposer`) chamam
  `supabase.rpc("rpc_notificar_mencao", {...})` logo após o `salvar.mutate` do comentário ter
  sucesso, só quando `mencionados.length > 0`.
- `npm run gen:types` após a migration (nova função entra em `types.ts`).

## Plano de implementação

1. Migration `NNNNNNNNNNNNNN_rpc_notificar_mencao.sql`: função única com os 3 ramos por
   `p_entidade_tipo`, seguindo o padrão de `rpc_notificar_projeto_status`.
2. `gen:types:local` e conferir a assinatura em `types.ts`.
3. Extrair um helper de front comum (ex. `src/lib/notificarMencao.ts`) já que os 3 call sites
   fazem a mesma chamada com `entidade_tipo` diferente — evita repetir o `supabase.rpc(...)` 3x.
4. Plugar o helper nos 3 pontos: `ProjetoAtividadesPanel`, `DisciplinaDetailDialog`,
   `TarefaDialog`.
5. Testar manualmente os 3 fluxos local (Supabase local + `dev`): mencionar, checar notificação
   aparece pro destinatário certo, link abre o item certo.
6. Antes de PR: `npm run gen:types` (staging) e commitar `types.ts`.

## Decisões e riscos

- **RPC chamada pelo front, não trigger no jsonb.** Comentários vivem em coluna jsonb
  (`comentarios`), não em tabela própria — não dá pra ter trigger de `INSERT` por comentário
  individual sem reescrever o modelo de dados. RPC pós-save é o mesmo padrão já usado por
  `rpc_notificar_projeto_status`/`rpc_notificar_proxima_etapa` nesta mesma migration de origem.
- **Risco:** se o `salvar.mutate` falhar depois da RPC rodar (ou vice-versa), pode notificar sem
  o comentário ter persistido, ou persistir sem notificar. Mitigar chamando a RPC só no
  `onSuccess` do mutate (nunca em paralelo) — pior caso é "comentário sem notificação", não
  "notificação fantasma", que é o lado seguro do trade-off.
