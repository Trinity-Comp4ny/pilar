# SPEC 131: @all e marcação confiável nos comentários

**Data:** 2026-10-16  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** projetos / meu-trabalho / notificações

<!-- Origem: feedback do Bruno (VRZ, 16/10): "ao digitar @ e o nome da pessoa, a marcação
tem que gerar notificação; quero usar @all para avisar todos da empresa". A menção já existe
(SPEC 089, link no comentário na SPEC 103), então o relato tem duas leituras: o fluxo falha em
algum caso comum, e falta o aviso coletivo. Levantamento no código achou três falhas reais no
`AtividadeComposer` e na RPC (abaixo). Não reproduzido com o Bruno: confirmar com ele depois. -->

## Problema

Quem comenta no projeto, na disciplina ou na tarefa e digita `@Nome` espera que a pessoa seja
avisada. Hoje isso falha em três casos sem nenhum sinal:

1. **Nome digitado sem escolher na lista.** O aviso só sai para quem foi escolhido no menu
   (Enter, Tab ou clique). Digitar `@Maria` inteiro e enviar grava o texto, mas `mencionados`
   fica vazio e ninguém recebe nada.
2. **Nome com espaço.** O menu fecha no primeiro espaço, então `@Maria Silva` digitado à mão
   perde a marcação no meio do nome.
3. **Pessoa sem conta.** Quem existe em Pessoas mas não tem login (na VRZ são 4 de 10) não
   recebe aviso (regra da SPEC 089), e o autor não fica sabendo: parece que marcou.

Além disso, não há como chamar a empresa inteira.

## Objetivo

Marcar alguém com `@` avisa a pessoa em qualquer um dos três jeitos de digitar, o autor vê
quando marcou alguém que não tem como receber, e `@all` avisa todos da empresa de uma vez.

**Fora de escopo:**

- Aviso por e-mail ou push. Segue só in-app (SPEC 089).
- Menção no chat de Agentes.
- Limite ou permissão especial para `@all` (suposição abaixo; reavaliar se virar ruído).
- Dar conta a quem não tem: é decisão de Pessoas/Administração.

## Requisitos

1. Ao enviar, o composer reconhece no texto todo `@Nome` que bate com o nome completo de uma
   pessoa da lista, mesmo que não tenha sido escolhido no menu, e inclui essa pessoa em
   `mencionados`. Nomes mais longos têm prioridade (`@Ana Paula` antes de `@Ana`).
2. O menu de menção continua aberto enquanto o texto depois do `@` for o começo do nome de
   alguém (permite `@Maria S`). Fecha quando deixa de bater com qualquer nome.
3. Na lista do menu, pessoa sem conta aparece com a marca "sem acesso". Marcar essa pessoa
   continua permitido (o texto fica no comentário), mas o composer mostra, abaixo da caixa,
   "Fulano não tem conta e não recebe o aviso." Aviso some se a pessoa é removida do texto.
4. `@all` (também `@todos`) é a primeira opção do menu quando o texto depois do `@` é o começo
   de "all" ou "todos". Ao enviar, o sistema avisa todo membro ativo da empresa com conta,
   exceto o autor.
5. A notificação de `@all` diz "<autor> marcou todos em "<contexto>"" e linka para o mesmo
   lugar da menção individual (SPEC 103). Quem recebe a menção individual e o `@all` no mesmo
   comentário recebe uma só notificação.
6. `@all` destaca no texto do comentário como as demais menções.

Requisitos não-funcionais:

- **Segurança / RLS:** a RPC segue `SECURITY DEFINER`, resolve `empresa_id` pelo registro
  comentado e exige que bata com `get_user_empresa_id()`. `@all` só alcança perfis da empresa
  do autor, sem `desativado_em`.
- **Multi-tenant:** nenhum destinatário de outra empresa.
- **Compatibilidade:** a assinatura nova tem `p_todos boolean DEFAULT false`, então o bundle
  antigo (que chama sem o parâmetro) segue funcionando na janela de deploy.

## Critérios de aceite

- [ ] Dado `@Maria Silva` digitado inteiro sem usar o menu, quando envia, então Maria Silva
      está em `mencionados` e recebe a notificação.
- [ ] Dado `@Ana Paula` e uma pessoa chamada `Ana`, quando o texto é `@Ana Paula`, então só
      Ana Paula é marcada.
- [ ] Dado o menu aberto em `@Maria`, quando digita espaço e `S`, então o menu continua com
      Maria Silva; quando digita `@Maria e` o menu fecha.
- [ ] Dado alguém sem conta na lista, então o menu mostra "sem acesso" e, marcada, o composer
      avisa que a pessoa não recebe.
- [ ] Dado `@all` em comentário de projeto, disciplina ou tarefa, quando envia, então todo
      membro ativo da empresa com conta, menos o autor, recebe uma notificação com o link do
      comentário.
- [ ] Dado `@all` e `@Maria` no mesmo comentário, então Maria recebe uma notificação.
- [ ] Caso de borda: membro desativado (`desativado_em` preenchido) e perfil de outra empresa
      não recebem o `@all`.
- [ ] Caso de borda: comentário sem menção não chama a RPC.

## Dados e contratos

- Migration: `rpc_notificar_mencao(p_entidade_tipo, p_entidade_id, p_mencionados, p_preview,
p_comentario_id, p_todos boolean DEFAULT false)`; a de 5 argumentos é removida (padrão da
  SPEC 103). Sem tabela nova.
- Front: `notificarMencao(..., comentarioId, todos)` repassa `p_todos`. `mencoes.ts` ganha o
  token `@all`/`@todos` e uma função que extrai ids de `@Nome` do texto.
- Lista de pessoas sem conta: uma query compartilhada (`pessoas` com `profile_id` nulo),
  em cache, usada só pelo composer.

## Plano de implementação

1. Migration da RPC com `p_todos` + teste pgTAP (`supabase/tests/mencao_para_todos.sql`).
2. `mencoes.ts`: token do `@all` e extração de menções do texto, com testes.
3. `AtividadeComposer`: menu com "Todos", regra de espaço, extração ao enviar, marca
   "sem acesso" e aviso. Teste de componente.
4. Os três pontos de chamada repassam o flag de `@all`.

## Decisões e riscos

- **Suposição:** qualquer membro pode usar `@all` (o Bruno pediu sem restrição). Risco: ruído
  em empresa grande. Se virar problema, restringir a admin ou limitar a um uso por entidade a
  cada N minutos.
- **Suposição:** "todos" são perfis com conta e `desativado_em` nulo, inclusive quem não tem
  linha em Pessoas (sócio admin, por exemplo).
- **Não reproduzido com o cliente.** As três falhas vêm da leitura do código; falta confirmar
  com o Bruno qual delas ele pegou.
