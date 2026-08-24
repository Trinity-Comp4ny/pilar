# SPEC 060: Soft delete por RPC nas tabelas que escondem linha deletada

**Data:** 2026-08-24
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** plataforma / financeiro / comercial / obras

## Contexto

Excluir cliente, receita, despesa e conta falha para **todo usuário**, em
produção, com `42501`. A VRZ relatou o caso de projeto em 22/08 e a
[migration 20260858000000](../../supabase/migrations/20260858000000_rpc_excluir_projeto.sql)
consertou aquela tabela; ao auditar as outras 16 do mesmo padrão (follow-up
registrado na [SPEC 058](./058-acesso-por-role-observabilidade-total-mfa-opcional.md)),
o problema apareceu em todas as que tinham linha para testar.

Medido em produção em 24/08, como o admin da VRZ, em transação revertida:

| Tabela | Linhas visíveis | Resultado |
| --- | --- | --- |
| clientes | 125 | `42501` |
| projetos | 96 | `42501` (já corrigido) |
| receitas | 17 | `42501` |
| despesas | 3 | `42501` |
| contas | 1 | `42501` |

As outras 12 ficaram inconclusivas apenas porque a VRZ não tem linha nelas.

## A mecânica

A explicação registrada na 20260858000000 está incompleta: não é o `WITH CHECK`
da policy de escrita, que nem menciona `deleted_at`.

Um `UPDATE` que referencia coluna na cláusula `WHERE` (o `.eq("id", id)` que todo
call site usa) faz o Postgres aplicar as policies de **SELECT** também à **linha
nova**. A linha nova tem `deleted_at` preenchido, a policy de SELECT exige
`deleted_at IS NULL`, e a escrita volta como
`42501 new row violates row-level security policy`.

Provado por controle, na mesma tabela e no mesmo padrão:

```
UPDATE clientes SET deleted_at = now() WHERE id = X  → 42501
UPDATE clientes SET contato = 'x'      WHERE id = X  → passa
```

O caminho de "Desfazer" tem o problema espelhado: a linha excluída não passa pela
policy de SELECT, então o `UPDATE` do cliente não encontrava nada e o desfazer
falhava calado.

## Achado paralelo: as policies de `clientes` não vêm de migration

Ao escrever o teste, o banco local (construído das migrations, igual ao do CI)
não reproduziu o bug para `clientes`. Comparando os dois:

- 224 policies nos dois ambientes
- 26 com `deleted_at IS NULL` no local, **28 em produção**
- a diferença é exatamente `clientes_select` e `clientes_write`

A última migration que define essas duas é a `20260507300000`, e ela **não** tem
a condição. Alguém acrescentou direto no banco, sem migration. Duas
consequências que já valiam:

1. O CI validava, para `clientes`, uma policy que produção não roda. A suíte de
   RLS dava garantia sobre o schema errado.
2. Qualquer migration futura que recriasse essas policies removeria a condição em
   produção sem ninguém notar, e cliente excluído voltaria a aparecer nas listas.

As outras 15 tabelas com o mesmo desenho vêm de migration corretamente, então a
condição é a intenção do projeto: o certo é formalizar, não remover.

## Requisitos

1. Formalizar `clientes_select` e `clientes_write` com `deleted_at IS NULL` em
   migration. Produção não muda de comportamento; quem passa a bater é o local.
2. Três RPCs `SECURITY DEFINER`: `rpc_soft_delete(tabela, id)`,
   `rpc_soft_delete_grupo(tabela, grupo_parcela)` (o Financeiro exclui todas as
   parcelas de uma vez) e `rpc_restaurar(tabela, id)`.
3. Allowlist explícita de tabela em `_soft_delete_feature`, mapeando cada tabela
   para a feature que governa a escrita dela. Tabela fora da lista é recusada com
   `22023`. É o que fecha o SQL dinâmico, junto de `format('%I')`.
4. As RPCs reproduzem a regra de acesso das policies de cada tabela: empresa da
   linha igual à do caller, mais o gate de módulo onde a policy usa um. As
   policies de `obra_*` checam consistência de FK na escrita; soft delete não
   muda FK nenhuma, então essa parte não se aplica.
5. Resposta única (`P0002`) para "não existe", "de outra empresa" e "já
   excluído": não vale contar a diferença para quem não deveria ver a linha.
6. Um helper no front (`src/lib/softDelete.ts`) decide entre RPC e `UPDATE`
   direto, com teste comparando a lista dele contra a allowlist do banco. As
   tabelas sem `deleted_at` na policy de SELECT (leads, propostas, pessoas,
   metas, centros_custo, folha_pagamento, transferencias) seguem no `UPDATE`
   direto, que é o caminho correto para elas.

## Por que uma função genérica, e não 32

São 16 tabelas. Duas RPCs por tabela seria a mesma regra copiada 32 vezes, cada
cópia um lugar a mais para divergir. O risco da versão genérica é o SQL dinâmico
dentro de função privilegiada, e ele fica fechado pela allowlist (a tabela precisa
estar no `CASE`) mais `format('%I')`, nunca concatenação.

## Não incluído

- **Consolidar `projetos`.** Ele entra na allowlist (senão o fallback do helper
  reintroduziria o bug), mas `Projetos.tsx` segue usando as RPCs dedicadas da
  20260858000000. Unificar é follow-up: não vale mexer numa mudança que subiu no
  mesmo dia.
- **Exclusão em massa no Lançamentos faz hard delete.**
  `LancamentosTable.deleteItems` chama `.delete()` em receitas e despesas,
  enquanto a exclusão individual faz soft delete, e transferencias no mesmo bloco
  é soft. Funciona (hard delete passa pela RLS), então não é bug, mas é perda
  permanente onde o resto do app é recuperável. Decisão de produto, fica fora.
- **As 16 tabelas com `deleted_at` que ninguém exclui pelo front hoje** ganham as
  RPCs de graça, mas não têm call site: não inventei tela nova.

## Critérios de aceite

1. Excluir e restaurar cliente, receita, despesa, conta, cartão, categoria,
   fornecedor, obra, material, cotação e lançamento de obra funciona.
2. `UPDATE` direto de `deleted_at` continua falhando (o pgTAP fixa a regressão);
   se um dia passar a funcionar, as RPCs podem sair.
3. Tabela fora da allowlist é recusada, inclusive nome com tentativa de injeção.
4. Não alcança linha de outra empresa, e a resposta é a mesma de inexistente.
5. A lista do front e a allowlist do banco são idênticas (teste de sincronia).
6. `supabase test db` e `npm run test:run` verdes.
