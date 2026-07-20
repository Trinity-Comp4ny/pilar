# QA Backend — Integridade de DELETE e EDIT

Ambiente: banco LOCAL (`supabase_db_rizaklgstyfrwgmdsldf`, PG17), empresa `937f6812-e91c-4747-a345-b98f0bba0d41`.
Data: 2026-07-17. Método: inserção de dados de teste com prefixo `QADEL-`, DELETE/UPDATE cru via psql, inspeção antes/depois. Dados limpos ao final.

## TL;DR (achado que domina todos os outros)

**Todo DELETE em clientes, projetos, receitas, despesas, fornecedores, leads e escopos é convertido em SOFT DELETE pelo banco**, independentemente do que o código do front faz. Existe um trigger `BEFORE DELETE ... EXECUTE FUNCTION soft_delete_generic()` em cada uma dessas tabelas:

```sql
CREATE FUNCTION public.soft_delete_generic() RETURNS trigger AS $$
BEGIN
  EXECUTE format('UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME) USING OLD.id;
  RETURN NULL;   -- cancela o DELETE real
END; $$ ...
```

Consequência: o `RETURN NULL` cancela o DELETE físico, então **as regras de FK ON DELETE (CASCADE / SET NULL / RESTRICT) nunca disparam** — a linha nunca é removida de fato. Um `DELETE` sempre reporta `DELETE 0` e a linha continua existindo com `deleted_at` preenchido.

Isso **contradiz frontalmente os achados prévios ACH-FOR-01 e ACH-PROJ-14** (que descreviam hard delete orfanizando/cascateando). No schema local atual, nada disso acontece: é soft delete puro, sem órfãos e sem cascata física.

## FKs reais declaradas (pg_constraint) — porém DORMENTES por causa do trigger

| child.coluna | parent | ON DELETE declarado | Efeito real (com trigger) |
|---|---|---|---|
| projetos.cliente_id | clientes | **RESTRICT** | nunca dispara (cliente vira soft delete) |
| receitas.cliente_id | clientes | SET NULL | nunca dispara |
| receitas.projeto_id | projetos | SET NULL | nunca dispara |
| propostas.cliente_id / lead_id / projeto_id | clientes/leads/projetos | SET NULL | nunca dispara |
| leads.cliente_id | clientes | SET NULL | nunca dispara |
| despesas.fornecedor_id | fornecedores | SET NULL | nunca dispara |
| despesas.projeto_id | projetos | SET NULL | nunca dispara |
| escopos.projeto_id | projetos | **CASCADE** | nunca dispara |
| escopo_itens.escopo_id / escopo_historico.escopo_id | escopos | CASCADE | (só se escopo for hard-deletado, que não ocorre) |
| marcos_faturamento / orcamento_versoes / projeto_disciplinas / projeto_orcamento_fases / portal_entregas / timesheet_lancamentos . projeto_id | projetos | CASCADE | nunca dispara |
| metas.projeto_id / grupos_parcela.projeto_id | projetos | SET NULL | nunca dispara |
| cliente_portal_accounts.cliente_id | clientes | CASCADE | nunca dispara |

Nota: `receitas.grupo_parcela` e `despesas.grupo_parcela` são colunas `uuid` **soltas, sem FK** para `grupos_parcela` (aceitam uuid inexistente).

## Comportamento do CÓDIGO (hooks) vs comportamento do BANCO

| Entidade | Código do front | Confirmação | Undo (UI) | Efeito real no banco |
|---|---|---|---|---|
| Cliente | soft delete (`update deleted_at`) — `useClientes.ts:277` | toast | **Sim** (restoreMutation) | soft delete |
| Lead | soft delete (`update deleted_at`) — `useLeads.ts:319` | toast | **Sim** (restore) | soft delete |
| Fornecedor | `.delete()` (hard) — `SupplierManager.tsx:156` | ConfirmDialog | Não | **soft delete** (trigger) |
| Projeto | `.delete()` (hard) — `Projetos.tsx:107` | ConfirmDialog ("não pode ser desfeita") | Não | **soft delete** (trigger) |
| Receita/Despesa | `.delete()` (hard) — `LancamentosTable.tsx:376-412` | ConfirmDialog | Não | **soft delete** (trigger) |
| Transferência | soft delete / RPC `rpc_excluir_transferencia` | ConfirmDialog | Não | soft delete |

## Testes por entidade

### 1. Cliente — PASS (soft delete, filhos intactos)
Criado `QADEL-cli` + projeto + receita vinculados. `DELETE FROM clientes`:
- `DELETE 0`; cliente continua, `deleted_at` preenchido.
- projeto.cliente_id e receita.cliente_id **continuam apontando** para o cliente soft-deletado (RESTRICT não bloqueou, SET NULL não zerou).
- É soft delete. FK RESTRICT em projetos jamais impede excluir cliente (porque não há delete físico).

### 2. Fornecedor — FAIL do achado ACH-FOR-01 (não reproduz)
Criado `QADEL-forn` + despesa vinculada. `DELETE FROM fornecedores`:
```
fornecedor | soft_del=true
despesa fk | fornecedor_id ainda = 2222...0001 (NÃO virou NULL)
```
**Despesa NÃO é orfanada.** Fornecedor vira soft delete apesar do código chamar hard delete. ACH-FOR-01 (hard delete orfana via SET NULL) **não se confirma** no schema atual.

### 3. Projeto — FAIL do achado ACH-PROJ-14 (não reproduz)
Criado `QADEL-proj` + escopo (`original`) + receita. `DELETE FROM projetos`:
```
projeto soft_del         = true
escopo exists            = true   (NÃO cascateou)
escopo soft_del          = false  (segue vivo)
receita projeto_id NULL? = false  (NÃO orfanou)
receita soft_del         = false
```
**Escopo não cascateia e receita não orfana.** ACH-PROJ-14 não se confirma.

> **Novo achado (ACH-DEL-02):** escopo e receita ficam VIVOS (`deleted_at NULL`) pendurados num projeto oculto (`deleted_at` setado). Toda query que filtra só o `deleted_at` do próprio registro (sem checar o do projeto-pai) exibe filhos de um projeto "excluído". É orfanização por visibilidade, não por FK, e produz números/listagens inconsistentes.

### 4. Lançamento parcelado — PASS
Criado grupo de 3 parcelas de receita (mesmo `grupo_parcela`). `DELETE` só na parcela 2/3:
```
QADEL-parc 1/3 | soft_del=f
QADEL-parc 2/3 | soft_del=t
QADEL-parc 3/3 | soft_del=f
```
Some **só a parcela alvo** (soft). As demais permanecem. Bate com a UI: "Apenas esta parcela será excluída" (single) vs "Excluir grupo inteiro" (bulk). `grupo_parcela` sem FK: parcelas apontam para uuid de grupo que pode nem existir.

### 5. Lead — PASS (soft delete)
`DELETE FROM leads` → `soft_del=true`. Confirma soft delete (código já usa update; DB reforça).

### 6. Edit (cliente e projeto) — PASS (auditoria funciona)
UPDATE com sessão autenticada simulada (`request.jwt.claims` com sub=admin):
- Projeto: `valor_contrato` 99999 e `data_inicio` gravados; `updated_at` avançou; `updated_by` = uid do admin.
- Cliente: `nome` alterado; `updated_at` avançou; `updated_by` = uid do admin.
- Trigger `handle_record_audit()` (BEFORE INSERT/UPDATE) grava `updated_at=NOW()` e `updated_by=auth.uid()` em todas essas tabelas. Em sessão sem JWT (psql puro) `updated_by` fica NULL.
- **Sem recálculo derivado no próprio projeto** ao editar valor: `valor_contrato` é armazenado cru; roll-ups financeiros são calculados em query no app, não por trigger. `status_data` só é recomputado em transição de status (trigger `calculate_status_data`), não ao editar valor/data. O fluxo inverso (escopo aprovado → atualiza projeto) existe, mas editar o projeto direto não propaga.

## CHECK constraints em valores — ACH-FIN-11 CONFIRMADO
```sql
-- Únicos CHECK em receitas/despesas:
despesas_periodicidade_check  -- só valida periodicidade
-- receitas: NENHUM check
```
**Não existe `CHECK (valor > 0)`** em `receitas` nem `despesas`. `valor` é apenas `NOT NULL numeric`. Aceita 0 e negativos. ACH-FIN-11 confirmado.

## Achados

- **ACH-DEL-01 (grave):** DELETE físico é impossível pela aplicação — trigger `soft_delete_generic` converte todo DELETE em soft delete e cancela o físico (`RETURN NULL`). Efeito colateral: **as FKs ON DELETE declaradas (CASCADE/SET NULL/RESTRICT) são todas letra morta**. Achados ACH-FOR-01 e ACH-PROJ-14 (orfanização/cascata por hard delete) NÃO se reproduzem no schema atual.
- **ACH-DEL-02 (grave):** Soft delete de projeto/cliente deixa filhos (escopos, receitas, despesas, propostas) VIVOS apontando para pai oculto. Sem propagação de soft delete nem filtro de `deleted_at` do pai nas queries filhas → listagens e somatórios podem incluir filhos de entidade "excluída". Risco de número errado no financeiro.
- **ACH-DEL-03 (médio, UX):** Copy de exclusão de projeto diz "Esta ação não pode ser desfeita. Todos os dados do projeto serão removidos." — **falso nas duas afirmações**: é reversível (basta zerar `deleted_at`) e nada é removido. Código chama `.delete()` (hard) sem oferecer Undo, enquanto cliente/lead oferecem Undo. Inconsistência: fornecedor/projeto/receita/despesa NÃO têm botão desfazer, apesar de serem recuperáveis no banco.
- **ACH-DEL-04 (baixo):** `grupo_parcela` em receitas/despesas não tem FK para `grupos_parcela`; é uuid solto. Parcelas podem referenciar grupo inexistente sem erro; deletar 1 parcela não atualiza integridade do grupo além do trigger de recalc (que não acha grupo).
- **ACH-FIN-11 (confirmado):** sem `CHECK (valor > 0)` em receitas/despesas; aceita zero/negativo.

## Verificação (PASS/FAIL)
- Delete cliente/lead = soft: **PASS**
- Delete fornecedor orfaniza despesa (ACH-FOR-01): **FAIL ao reproduzir** (é soft delete, sem órfão)
- Delete projeto cascateia escopo + orfaniza receita (ACH-PROJ-14): **FAIL ao reproduzir** (é soft delete, filhos vivos)
- Delete 1 parcela remove só ela: **PASS**
- Edit grava updated_at/updated_by: **PASS**
- CHECK valor>0 (ACH-FIN-11): **FAIL** (ausente, como esperado pelo achado)

## Limpeza
Todos os registros `QADEL-` removidos fisicamente via `SET session_replication_role = replica` (bypass do trigger). Verificado: 0 linhas remanescentes em todas as tabelas.
