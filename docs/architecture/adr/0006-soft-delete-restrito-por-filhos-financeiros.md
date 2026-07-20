# ADR 0006: Bloquear soft delete de projeto/cliente com filhos financeiros vivos

**Data:** 2026-07-20
**Status:** Accepted

## Contexto

O trigger `soft_delete_generic()` (BEFORE DELETE em clientes, projetos, receitas,
despesas, fornecedores, leads, escopos) converte todo DELETE em `UPDATE deleted_at`
+ `RETURN NULL`. Efeito colateral: **nenhuma FK `ON DELETE` (CASCADE/SET NULL/
RESTRICT) do schema dispara** — todas viraram letra morta.

Consequência (achado de QA ACH-DEL-02): ao soft-deletar um projeto ou cliente, os
filhos (receitas/despesas com `projeto_id`/`cliente_id`) continuam com `deleted_at
IS NULL`. A RLS de receitas/despesas só filtra o `deleted_at` do próprio registro,
então esses filhos seguem visíveis e **entram em ~7 rollups de KPI financeiro**
(dashboard, VisãoGeral, FluxoCaixa, ResumoMensal, DRE, Aging, Health Index),
inflando números que o usuário toma por confiáveis.

Opções consideradas:

- **Bloquear na fonte (RESTRICT lógico):** não deixar excluir projeto/cliente com
  filhos financeiros vivos. Prós: corrige o número na fonte, não-destrutivo, o
  estado órfão nunca nasce. Contras: usuário precisa tratar os lançamentos antes.
- **Cascatear o soft delete:** soft-deletar os filhos junto. Prós: um ponto corrige
  tudo. Contras: excluir cliente vira destrutivo em cascata; o undo precisa reverter
  a cascata inteira.
- **Defensivo por query:** ancorar cada rollup em `projetos/clientes.deleted_at IS
  NULL`. Prós: não-destrutivo. Contras: ~11 pontos, e rollups futuros esquecem o
  filtro.

## Decisão

Bloquear na fonte. `soft_delete_generic()` passa a checar, por `TG_TABLE_NAME`, se
há filhos financeiros vivos antes de excluir, e aborta com
`ERRCODE = 'foreign_key_violation'` e mensagem acionável em PT-BR.

```sql
-- projetos: bloqueia se há receitas OU despesas vivas com projeto_id = OLD.id
-- clientes: bloqueia se há projetos OU receitas vivas com cliente_id = OLD.id
-- demais tabelas: soft delete direto, sem mudança
```

Migration: `supabase/migrations/20260720000006_soft_delete_restrict_parents.sql`.
A UI já propaga `error.message` no toast (ex.: `Projetos.tsx` handleDeleteConfirm),
então o usuário vê o motivo. A copy dos diálogos de exclusão foi ajustada para
refletir soft delete + bloqueio (ACH-DEL-03).

## Consequências

**Positivas:**

- Os KPIs financeiros deixam de contar filhos de entidade "excluída": o estado
  órfão não nasce mais. Correção na fonte, não em 11 queries.
- Não-destrutivo: nada é apagado em cascata; o undo existente (cliente/lead) segue
  válido.

**Negativas:**

- Excluir um projeto/cliente com lançamentos exige tratar os lançamentos antes
  (passo extra para o usuário). É o trade-off aceito em nome do número correto.
- Registros legados já órfãos (pai soft-deletado antes desta migration com filhos
  vivos) não são corrigidos retroativamente; se existirem em prod, precisam de uma
  limpeza pontual à parte.

## Decisões relacionadas

- ADR 0005: permissões e feature flags (gates de RLS financeiro).
- Migration `20260720000006`; achados de QA ACH-DEL-02 / ACH-DEL-03 (`qa-report/`).
