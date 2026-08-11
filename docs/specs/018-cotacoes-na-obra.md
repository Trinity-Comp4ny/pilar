# SPEC: Cotações na obra

**Data:** 2026-08-11
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** obras

## Problema

Na obra por administração o sócio pede preço de material/serviço a vários
fornecedores, precisa comparar as ofertas e justificar a escolha (para o cliente
e para si). Hoje isso vive em WhatsApp e planilha solta: a decisão de compra não
fica registrada na obra, e a prestação de contas perde o rastro de por que aquele
fornecedor foi escolhido.

## Objetivo

Dentro da obra, registrar uma necessidade de compra, juntar as propostas dos
fornecedores, compará-las lado a lado e decidir a vencedora, podendo lançar a
escolha direto como despesa na conta da obra. Depois desta feature o escritório
mostra "peguei 3 orçamentos e escolhi este" sem sair do Pilar.

**Fora de escopo:**
- Cotação de cesta (vários itens numa cotação). MVP é **item único por cotação**.
- Tela no portal do cliente. O schema já isola por `empresa_id` e nasce pronto
  para expor, mas a visão do cliente fica para V2 (inclusive a decisão de mostrar
  as propostas perdedoras ou só a vencedora).
- Upload de arquivo. O orçamento do fornecedor entra por **link** (regra de anexos
  por link, não hospedar binário).
- App/PWA de campo. Web responsivo cobre o registro na obra.
- RPC nova. A decisão é um `UPDATE` simples; o lançamento de despesa reusa
  `rpc_obra_despesa_salvar` (spec 016).

## Requisitos

Funcionais:

1. O usuário com permissão de editar obra pode criar uma cotação com descrição
   (obrigatória), quantidade, unidade, etapa (frente), prazo de necessidade e
   observações.
2. Numa cotação aberta, o usuário adiciona N propostas. Cada proposta tem um
   fornecedor (do cadastro **ou** nome livre), valor (obrigatório), prazo de
   entrega em dias, condição de pagamento e link do orçamento.
3. As propostas aparecem numa tabela comparável; a de menor valor é destacada.
4. O usuário escolhe a vencedora. A cotação passa a `decidida` e guarda a proposta
   vencedora.
5. Ao decidir, o usuário pode optar por lançar a vencedora como despesa na conta
   da obra (descrição = cotação + fornecedor, valor = proposta, etapa herdada).
6. A cotação decidida pode ser reaberta (volta a `aberta`, limpa a vencedora).
7. A lista de cotações da obra mostra status, nº de propostas e menor preço.

Não-funcionais:

- **Segurança / RLS:** `obra_cotacao` e `obra_cotacao_proposta` com RLS por
  `empresa_id = get_user_empresa_id()`, revalidando as FKs cross-tenant (obra,
  frente, fornecedor, proposta vencedora). Grants só para `authenticated`.
- **Multi-tenant:** isolamento por `empresa_id` em ambas as tabelas.
- **Financeiro:** o lançamento de despesa passa pelo RPC transacional existente,
  então a taxa de administração e a margem seguem corretas sem código duplicado.

## Critérios de aceite

- [x] Dado uma obra, quando crio uma cotação só com descrição, então ela aparece
      na lista como `aberta`, com "Sem propostas".
- [x] Dado 3 propostas numa cotação, quando abro o detalhe, então vejo as 3 em
      tabela e a de menor valor destacada como "menor".
- [x] Dado propostas cadastradas, quando escolho uma como vencedora sem lançar
      despesa, então a cotação vira `decidida`, a vencedora fica marcada e a conta
      da obra não muda.
- [x] Dado que escolho a vencedora com "lançar despesa", então surge uma despesa
      na conta da obra com o valor e o fornecedor da proposta.
- [x] Caso de borda: proposta sem fornecedor cadastrado usa o nome livre; sem
      nenhum dos dois, exibe "Fornecedor sem nome".
- [x] Caso de borda: cotação sem propostas retorna menor preço nulo (nada a
      comparar), sem quebrar a lista.
- [x] Sem permissão de editar, o usuário vê cotações e propostas mas não os botões
      de criar/editar/excluir/decidir.

## Dados e contratos

Tabelas novas (migration `20260811120000_obra_cotacoes.sql`):

- **`obra_cotacao`**: `id, empresa_id, obra_id, obra_frente_id?, descricao,
  quantidade?, unidade?, prazo_necessidade?, status (aberta|decidida|cancelada),
  proposta_vencedora_id?, observacoes?` + auditoria + `deleted_at`.
- **`obra_cotacao_proposta`**: `id, empresa_id, cotacao_id, fornecedor_id?,
  fornecedor_nome?, valor, prazo_entrega_dias?, condicao_pagamento?,
  link_orcamento?, observacoes?` + auditoria + `deleted_at`.

A FK `proposta_vencedora_id → obra_cotacao_proposta` é adicionada depois das duas
tabelas (dependência circular), com `ON DELETE SET NULL`.

Front consome via `useObraCotacoes(obraId)`, que devolve cada cotação com as
propostas embutidas (`propostas` + `fornecedor` de cada uma), filtrando propostas
soft-deleted que o embed do PostgREST não remove sozinho.

## Plano de implementação

1. Migration com as duas tabelas, RLS, triggers de `updated_at` e grants. ✅
2. Registry de status: domínio `cotacao` (aberta/decidida/cancelada). ✅
3. `src/lib/obras.ts`: `CotacaoStatus`, `menorValorProposta`, `nomeFornecedorProposta` + testes. ✅
4. `src/hooks/useObraCotacoes.ts`: query + mutations (salvar/excluir/reabrir cotação,
   salvar/excluir proposta, decidir com lançamento opcional de despesa). ✅
5. Componentes: `ObraCotacoesTab`, `CotacaoFormDialog`, `CotacaoDetailDialog`
   (com form de proposta e diálogo de decisão internos). ✅
6. 5ª aba "Cotações" em `src/pages/obras/[id]/index.tsx`. ✅
7. `npm run gen:types` (gerado do banco local; diff = só as duas tabelas novas). ✅

## Decisões e riscos

- **Sem RPC para decidir.** Marcar a vencedora é um `UPDATE` coberto por RLS; o
  dinheiro (a despesa) vai pelo RPC existente. Menos superfície nova.
- **Fornecedor livre.** A cotação de campo raramente tem o fornecedor cadastrado,
  então a proposta aceita nome cru. O cadastro tem prioridade quando existe.
- **Risco: dupla despesa.** Decidir com "lançar despesa" e depois reabrir e decidir
  de novo com despesa gera duas despesas (não há vínculo idempotente cotação↔despesa
  no MVP). Aceito; o extrato da conta é editável. Se virar dor, adicionar
  `obra_cotacao_id` em `obra_conta_lancamento` e tornar o lançamento idempotente.
- **Deploy:** migration aplicada só no banco **local**. `db:push:staging` /
  `db:push:prod` e o `gen:types` do ambiente são passos explícitos posteriores
  (ADR 0007), fora desta entrega.
