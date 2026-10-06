# SPEC: Conversa no lugar certo (link direto, menção destacada, perfil da pessoa)

**Data:** 2026-10-06
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** projetos / meu-trabalho / notificações / pessoas
**Depende de:** [SPEC 089](089-notificacao-de-mencao.md), [SPEC 102](102-notificacoes-de-pessoas.md)

<!-- Origem: VRZ (06/10). O Flávio escreveu "@Larissa liberado para detalhamento" nas
Atividades do projeto 367. A notificação chegou, mas o clique abre /projetos/:id, a página
cheia, que não tem painel de Atividades: os comentários de projeto só existem no modal da
lista de /projetos. A Larissa caiu numa tela sem a conversa. Junto, dois pedidos do Matheus:
a menção fica verde enquanto se digita, mas vira texto comum depois de enviada; e clicar na
menção deveria mostrar quem é a pessoa. -->

## Problema

Quem é marcado num comentário cai numa tela genérica e precisa procurar onde falaram com ele.
Depois de enviada, a menção perde o destaque, e não há como saber quem é a pessoa citada (cargo,
contato) sem sair da conversa.

## Objetivo

Clicar numa notificação de menção abre a conversa já no comentário, com o histórico em volta.
Menção enviada continua destacada e, clicada, mostra o perfil público da pessoa.

**Fora de escopo:**

- **Editar ou apagar comentário.** Continua sem edição pós-envio.
- **Página de perfil própria** (`/pessoas/:id` para todos). O perfil é um cartão sobre a
  conversa; a tela de Pessoas segue restrita como hoje.
- **Telefone, endereço, documentos e dados de folha** no perfil público. Ficam onde estão,
  atrás de `can_view_folha()`.
- **Respostas em thread.** A conversa segue linear.

## Requisitos

1. **Aba Atividades na página do projeto.** `/projetos/:id` ganha a aba "Atividades"
   (`#atividades`), com o mesmo painel do modal (mesmos dados, mesmo composer).
2. **Abrir pelo link.**
   - `/projetos/:id?comentario=:cid#atividades` abre a aba e rola até o comentário.
   - `/projetos/:id?disciplina=:did[&comentario=:cid]` abre a disciplina e, se houver, rola até o
     comentário dentro dela.
   - `/gestao/tarefas?tarefa=:tid[&comentario=:cid]` abre a tarefa. Se a pessoa não tiver acesso
     à tarefa, aparece "Você não tem acesso a esta tarefa. Peça ao responsável para te
     incluir." em vez de nada.
   - O comentário de destino aparece com borda verde por alguns segundos.
   - Fechar o dialog limpa os parâmetros da URL (voltar não reabre).
3. **Notificação de menção aponta para o comentário.** `rpc_notificar_mencao` recebe o id do
   comentário e monta o link acima. Cada comentário é uma notificação própria: duas menções em
   comentários diferentes chegam as duas, mesmo com a primeira não lida.
4. **Menção destacada depois de enviada.** No comentário enviado, cada `@Nome` de uma pessoa
   mencionada aparece com o mesmo verde do composer. Vale para projeto, disciplina e tarefa
   (um componente só, `ComentarioCard`).
5. **Perfil público ao clicar na menção.** Abre um cartão com: nome, cargo, e-mail, se tem conta
   no Pilar, e as disciplinas em andamento em que ela é responsável (até 5, com o projeto).
   Visível para qualquer membro da empresa, sem depender do módulo Pessoas.
6. Os itens do quadro de tarefas que são disciplina passam a abrir a disciplina direto
   (`?disciplina=`), não só o projeto.

Não-funcionais:

- **Segurança:** perfil via RPC `SECURITY DEFINER` que só devolve pessoa da mesma empresa do
  usuário e só os campos listados. Nenhum dado de folha, documento ou contato pessoal.
- **Multi-tenant:** `empresa_id` do chamador, nunca do parâmetro.
- **Compatibilidade:** notificação antiga (link `/projetos/:id` ou `/meu-trabalho`) continua
  funcionando; só não rola até o comentário.

## Critérios de aceite

- [ ] Dado um comentário com @Larissa nas Atividades do projeto, quando a Larissa clica na
      notificação, então abre `/projetos/:id` na aba Atividades com aquele comentário visível e
      destacado.
- [ ] Dado o mesmo numa disciplina, então abre o projeto com a disciplina aberta e o comentário
      destacado; numa tarefa, abre o quadro com a tarefa aberta.
- [ ] Dado duas menções à mesma pessoa em comentários diferentes antes de ela ler, então ela
      recebe duas notificações.
- [ ] Dado um comentário enviado com @Flávio, então "@Flávio" aparece em verde e clicável;
      ao clicar, o cartão mostra nome, cargo, e-mail e disciplinas em andamento.
- [ ] Caso de borda: dado um id de pessoa de outra empresa, então a RPC de perfil não devolve
      nada.
- [ ] Caso de borda: dado um link para tarefa sem acesso, então aparece a mensagem de acesso,
      sem tela quebrada.

## Dados e contratos

Na mesma migration da SPEC 102 (`20261009000000_notificacoes_de_pessoas.sql`):

- `rpc_notificar_mencao(p_entidade_tipo text, p_entidade_id uuid, p_mencionados uuid[],
p_preview text, p_comentario_id uuid DEFAULT NULL)`: DROP + CREATE (assinatura muda). Com
  comentário, grava `referencia_tipo = 'comentario'`, `referencia_id = :cid` (dedup por
  comentário) e o link profundo.
- `rpc_perfil_publico(p_pessoa_id uuid) → table(id, nome, cargo, email, avatar_url, tem_conta,
disciplinas jsonb)`.

Front:

- `src/components/atividades/ComentarioCard.tsx` (substitui os 3 cards iguais), com menção
  destacada e `destacado` para o comentário de destino.
- `src/components/atividades/PerfilPessoaPopover.tsx` + `usePerfilPublico`.
- `ProjetoDetailTabs`: aba Atividades e leitura de `?disciplina=`/`?comentario=`.
- `meu-trabalho/index.tsx`: leitura de `?tarefa=`/`?comentario=`.
- `notificarMencao(..., comentarioId)`.

## Plano de implementação

1. Migration (junto da SPEC 102) + pgTAP para perfil público e link da menção.
2. `gen:types` (a assinatura de `rpc_notificar_mencao` e a RPC nova entram em `types.ts`).
3. `ComentarioCard` + perfil, plugados nos 3 painéis.
4. Aba Atividades e parâmetros de URL nas duas telas.
5. Teste de componente para o destaque da menção e do comentário; typecheck, vitest, PR.

## Decisões e riscos

- **Aba nova na página, não abrir o modal da lista.** A notificação já leva à página cheia;
  faltava a conversa nela. Link por URL também funciona no e-mail e no celular.
- **Perfil sem telefone.** Telefone em `pessoas` costuma ser o celular pessoal; e-mail e cargo
  bastam para "quem é essa pessoa". Se o escritório pedir, entra depois como campo opcional.
- **Menção destacada só para quem está em `mencionados`.** Um "@" digitado sem escolher da
  lista continua texto comum, como já era no composer.
