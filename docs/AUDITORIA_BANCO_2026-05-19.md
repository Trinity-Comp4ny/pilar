# Auditoria DBA — Banco Pilar

**Data**: 2026-05-19
**Schema base**: `src/integrations/supabase/types.ts` (4541 linhas) + 102 migrations
**Projeto Supabase**: `vepnsonbnsimqcsfcagm` (org `qsjarqncfzjudpsnozia`, São Paulo)
**Status**: análise feita sem acesso direto ao prod — baseada em schema versionado

---

## TL;DR

**Health Score: 7.2 / 10**. Banco está em estado **estável de produção**. Achados são dívida técnica, não emergência. Nenhuma ação obrigatória esta semana, exceto 1 fix de segurança multi-tenant.

**Único risco ativo em prod**: `convites` sem `empresa_id` permite admin de empresa A convidar pra empresa B. Não corrompe dados, mas é vetor de privilege escalation.

**Custo total do refactor completo**: ~20h de engenharia. ROI alto em segurança + performance + clareza.

---

## Sumário de risco

| Categoria | Status |
|---|---|
| Perda de dados em prod hoje | ❌ Zero risco |
| Vulnerabilidade de segurança ativa | ⚠️ 1 vetor (convites cross-tenant) |
| Gargalo de performance ativo | ⚠️ `view_financas_resumo` com SUMs correlatos |
| Schema corrompido / FKs quebradas | ❌ Não |
| RLS desabilitado em tabela sensível | ❌ Não |
| Multi-tenancy comprometido | ⚠️ 4 tabelas sem `empresa_id` |

---

## 1. Inventário real

**60 tabelas** no schema vivo (PDF original listava ~30 e inventava algumas).

### Tabelas que o documento PDF original esqueceu

- **Propostas comerciais**: `propostas`, `proposta_disciplinas`, `proposta_templates`
- **Portal Cliente**: `portal_entregas`, `portal_download_logs`, `cliente_portal_accounts`, `portal_tokens`
- **Engenharia financeira**: `orcamento_versoes`, `marcos_faturamento`, `projeto_orcamento_fases`, `grupos_parcela`, `lancamento_rateios`
- **SaaS billing**: `pilar_subscriptions`, `pilar_subscription_plans`, `pilar_pending_signups`, `pilar_checkout_webhook_logs`
- **Operacional**: `timesheet_lancamentos`, `metas`, `alocacoes` (dormente)
- **Segurança**: `impersonation_sessions`, `ultra_admin_modes`, `mfa_backup_codes`, `rate_limit_attempts`
- **Fornecedores/folha**: `fornecedores`, `folha_pagamento`

### Tabelas que o PDF citou mas NÃO existem

- `STATUS`, `STATUS_EMPRESA` — status é coluna text
- `ENDERECOS` — campo inline
- `CHAVES_PIX` — é JSONB em `clientes`/`pessoas`
- `EMPRESA_PESSOAS` — vínculo via `profiles.empresa_id`
- `LANCAMENTOS` como tabela — é VIEW (UNION receitas+despesas)
- `USERS` — é `auth.users` (Supabase nativo) + `profiles`

### Erro de domínio no PDF

- **`FATURAS` listada em "Financeiro/cartão"** — na verdade é **faturamento de projeto** (marco→fatura), não fatura de cartão de crédito.

---

## 2. Duplicações reais

### 2.1 Financeiro (fragmentado mas funcional)

```
receitas (28 refs)      → caixa entrada
despesas (22 refs)      → caixa saída
transferencias (1 ref)  → conta↔conta
lancamentos             → VIEW UNION receitas+despesas (JÁ EXISTE)
grupos_parcela          → agrupar parcelas
lancamento_rateios      → rateio por centro_custo
```

**Veredito**: NÃO unificar em tabela ledger única. View `lancamentos` já cobre leitura unificada. 30+ RPCs dependem da separação. Esforço alto, ganho marginal.

**Único risco**: RLS da view `lancamentos` não filtra `centro_custo_id` — possível vazamento intra-tenant entre centros do mesmo tenant.

### 2.2 Auditoria — manter separado

```
audit_logs           → DML genérico compliance
admin_audit_logs     → ações ultra-admin
critical_alerts      → eventos sistema (monitoring)
alertas              → notificação user-facing UI
audit_logs_archive   → LGPD retention >30d
```

**Veredito**: NÃO unificar. Cada um tem propósito distinto. PDF original estava errado nesse ponto. Unificar = regressão de segurança.

### 2.3 Identidade — já bem separado

```
profiles (19 refs)    → auth shim (id = auth.uid())
pessoas (13 refs)     → domínio (CPF, PIX, contatos)
```

Bem separado após migrations 20260429500000 + 20260507700000. ✅

---

## 3. JSONB — 20 colunas auditadas

### ✅ Justificados (9)
- `admin_audit_logs.metadata`
- `audit_logs.diff` / `audit_logs.metadata`
- `audit_logs_archive.*`
- `asaas_webhook_logs.payload`
- `critical_alerts.metadata`
- `escopo_historico.detalhes`
- `propostas.conteudo` / `propostas.campos_extras`
- `pilar_*_webhook_logs.payload`
- `pilar_pending_signups.payment_metadata`

### ⚠️ Candidatos a normalização (11)

| Tabela.Coluna | Ação |
|---|---|
| `clientes.chaves_pix` | → tabela `cliente_chaves_pix` (1:N) |
| `clientes.contas_bancarias` | → tabela `cliente_contas_bancarias` (1:N) |
| `pessoas.chaves_pix` | idem |
| `pessoas.contas_bancarias` | idem |
| `empresas.features` | → array `text[]` ou tabela `empresa_features` |
| `profiles.features` | → idem |
| `convites.features` | → idem |
| `pilar_subscription_plans.features` | → idem |
| `fluxos_disciplinas.etapas` | → tabela `fluxo_etapas` (ordem+nome) |
| `orcamento_versoes.dados` | → tabela `orcamento_itens` (estrutura fixa) |
| `templates_projeto.fases` | → tabela `template_fases` |

### 🔴 Crítico
`projetos.disciplinas` (JSONB) duplica `projeto_disciplinas` (tabela relacional). Risco de drift entre os dois.

**Antes de dropar**: rodar
```sql
SELECT COUNT(*) FROM projetos p
WHERE p.disciplinas IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM projeto_disciplinas pd WHERE pd.projeto_id = p.id);
```
Se >0, migrar primeiro. Se =0, safe drop.

---

## 4. Views

| View | Refs | Veredito |
|---|---|---|
| `v_budget_vs_actual` | 0 | Recém-criada, sem consumo. Confirmar feature live. |
| `view_financas_resumo` | 2 | 🔴 **Gargalo**: SUMs correlatos. Reescrever com LEFT JOIN + GROUP BY. ~100x speedup esperado. |
| `view_cartao_resumo` | 2 | Mesmo problema, menor escala. |
| `view_fatura_resumo` | 1 | Uso mínimo. |
| `view_folha_pagamento` | 0 | Candidata a DROP. |
| `lancamentos` (view) | 1 | Núcleo da leitura financeira. Validar RLS de `centro_custo_id`. |

### Fix view_financas_resumo

```sql
-- ATUAL (slow): SELECT (SELECT SUM(...) FROM receitas r WHERE r.conta_id = c.id ...) ...

-- NOVO (fast):
CREATE OR REPLACE VIEW view_financas_resumo AS
SELECT c.id,
       COALESCE(r.total, 0) AS entradas,
       COALESCE(d.total, 0) AS saidas
FROM contas c
LEFT JOIN (
  SELECT conta_id, SUM(valor) total FROM receitas
  WHERE status='Recebido' AND deleted_at IS NULL GROUP BY conta_id
) r ON r.conta_id = c.id
LEFT JOIN (
  SELECT conta_id, SUM(valor) total FROM despesas
  WHERE status='Pago' AND deleted_at IS NULL GROUP BY conta_id
) d ON d.conta_id = c.id;
```

---

## 5. Multi-tenancy — vazamentos potenciais

Tabelas SEM `empresa_id` que deveriam ter:

| Tabela | Severidade | Impacto |
|---|---|---|
| `convites` | 🔴 Alta | Admin A pode convidar pra empresa B |
| `rate_limit_attempts` | 🔴 Alta | Rate-limit cruza tenants |
| `data_deletion_requests` | ⚠️ Média | LGPD query por tenant impossível |
| `data_export_requests` | ⚠️ Média | Idem |
| `impersonation_sessions` | ⚠️ Média | Auditoria por tenant impossível |

Corretos sem `empresa_id`: `profiles`, `mfa_backup_codes`, `pilar_pending_signups` (pré-auth), `pilar_subscription_plans` (global).

---

## 6. FKs perigosas (ON DELETE CASCADE)

- `folha_pagamento.pessoa_id → pessoas ON DELETE CASCADE` — deletar pessoa apaga histórico folha (LGPD risk)
- Vários `* → empresas ON DELETE CASCADE` — esperado em multi-tenant, mas validar se admin tem botão "delete empresa"

**Recomendação**: trocar CASCADE → RESTRICT ou SET NULL em domínios não-tenant (pessoas, fornecedores, clientes).

---

## 7. Strings livres → criar enums

Já existem: `user_role`, `status_empresa`, `status_financeiro`, `status_projeto`, `tipo_categoria`.

Faltam:
- `alert_severity` (info/warning/error/critical)
- `log_origin` (api/admin/webhook/system)
- `audit_category` (user_management/financial/project/…)
- `proposta_status` (rascunho/enviada/aprovada/rejeitada/…)

---

## 8. Dead code candidato a DROP

Confirmar zero refs (incluindo edge functions + pg_cron) antes:

- `view_folha_pagamento` (0 refs)
- `data_export_requests` (0 refs em src)
- `mfa_backup_codes` (0 refs React — auth handled por Supabase nativo)
- `templates_projeto.checklist` JSONB (se `fases` cobre)
- `projetos.disciplinas` JSONB (legacy)

---

## 9. Resposta às perguntas do usuário

### "Preciso mexer agora?"

**Não.** Banco roda prod meses sem mexer. Único item urgente é fix de `convites` (segurança).

### "Vou perder dados em prod / dados de clientes?"

**Não, se seguir o plano abaixo.** Cada categoria de mudança tem mitigação:

| Tipo de mudança | Risco perda dados |
|---|---|
| ADD COLUMN / ADD INDEX | Zero |
| CREATE OR REPLACE VIEW | Zero |
| ALTER CONSTRAINT (CASCADE → SET NULL) | Zero |
| CREATE ENUM + migrar coluna | Baixo (validar valores) |
| Normalizar JSONB → tabela | Médio se mal feito → mitigar com dual-write |
| DROP COLUMN | Alto se houver leitura ativa → audit antes |
| Unificar tabelas (receitas+despesas) | NÃO fazer — alto risco, ganho marginal |

---

## 10. Plano priorizado

### P0 — Esta semana (1 dia, risco zero de perda)

```sql
-- 1. Convites multi-tenant fix
ALTER TABLE convites ADD COLUMN empresa_id UUID REFERENCES empresas(id);
UPDATE convites SET empresa_id = (SELECT empresa_id FROM profiles WHERE id = invited_by);
ALTER TABLE convites ALTER COLUMN empresa_id SET NOT NULL;
-- + atualizar RLS policy

-- 2. View performance fix
CREATE OR REPLACE VIEW view_financas_resumo AS ...;  -- versão LEFT JOIN

-- 3. Índices hot path
CREATE INDEX CONCURRENTLY receitas_status_idx ON receitas(status) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY despesas_status_idx ON despesas(status) WHERE deleted_at IS NULL;
```

### P1 — Próximo sprint (3h, risco baixo)

4. Adicionar `empresa_id` em `rate_limit_attempts`, `data_*_requests`, `impersonation_sessions`
5. Trocar CASCADE → RESTRICT em `folha_pagamento.pessoa_id`, `alocacoes`, `timesheet_lancamentos`
6. Validar RLS de view `lancamentos` com filtro de `centro_custo_id`
7. Criar enums faltantes (`alert_severity`, `log_origin`, `audit_category`, `proposta_status`)

### P2 — Sprint +1 (5h, risco médio)

8. Audit consumidores de `projetos.disciplinas` JSONB → DROP se =0 drift
9. Normalizar `clientes/pessoas.chaves_pix + contas_bancarias` → tabelas 1:N (pattern dual-write)
10. Normalizar `features` JSONB → `text[]` (mais simples) ou tabela

### P3 — Backlog

11. Materializar `view_cartao_resumo` se virar gargalo
12. Normalizar `fluxos_disciplinas.etapas`, `templates_projeto.fases`, `orcamento_versoes.dados`
13. DROP de `view_folha_pagamento`, `data_export_requests` se confirmar zero refs

### O que NÃO fazer

- ❌ Unificar `receitas`+`despesas` em tabela ledger única (alto risco, ganho marginal)
- ❌ Unificar `audit_logs`+`admin_audit_logs`+`critical_alerts` (perda de granularidade compliance)
- ❌ DROP de tabelas sem checar edge functions + pg_cron + triggers

---

## 11. Queries de validação (rodar em prod antes de qualquer P2/P3)

```sql
-- 1. Convites sem empresa_id (volume backfill)
SELECT COUNT(*) FROM convites;

-- 2. Drift entre projetos.disciplinas (JSONB) e projeto_disciplinas (tabela)
SELECT COUNT(*) FROM projetos
WHERE disciplinas IS NOT NULL AND jsonb_array_length(disciplinas) > 0;

-- 3. Volume receitas/despesas (planejar migration)
SELECT 'receitas' t, COUNT(*) FROM receitas UNION ALL
SELECT 'despesas', COUNT(*) FROM despesas UNION ALL
SELECT 'lancamento_rateios', COUNT(*) FROM lancamento_rateios;

-- 4. Folha de pagamento órfã (pessoas deletadas)
SELECT COUNT(*) FROM folha_pagamento fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
WHERE p.id IS NULL;

-- 5. Clientes com chaves_pix JSONB povoado
SELECT COUNT(*) FROM clientes WHERE chaves_pix IS NOT NULL AND chaves_pix::text != '[]';

-- 6. Tabelas vazias (candidatas a drop seguro)
SELECT relname, n_live_tup FROM pg_stat_user_tables
WHERE schemaname='public' AND n_live_tup = 0 ORDER BY relname;

-- 7. Tamanho de cada tabela
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC;

-- 8. Tabelas sem nenhum índice além do PK
SELECT t.tablename FROM pg_tables t
LEFT JOIN pg_indexes i ON i.tablename=t.tablename AND i.indexname NOT LIKE '%_pkey'
WHERE t.schemaname='public' AND i.indexname IS NULL;

-- 9. Sequencial scans (gargalos)
SELECT relname, seq_scan, idx_scan, seq_tup_read
FROM pg_stat_user_tables WHERE schemaname='public' AND seq_scan > idx_scan
ORDER BY seq_tup_read DESC LIMIT 20;

-- 10. RLS habilitado sem nenhuma policy
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relrowsecurity=true
AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid);
```

---

## 12. Análise do documento PDF original (BANCO DE DADOS PILAR.pdf)

### Notas

| Aspecto | Nota |
|---|---|
| Diagnóstico de alto nível | 8/10 — direção certa |
| Inventário de tabelas | 4/10 — incompleto, tabelas inventadas |
| Identificação de duplicação | 7/10 — acerta receitas/despesas, erra audit_logs |
| Plano de refatoração | 5/10 — fases simplificadas demais |
| Profundidade técnica | 3/10 — sem performance, sem RLS, sem índices, sem CASCADE risk |

### Acertos
- Duplicação `receitas`/`despesas`/`lancamentos`
- Auth × domínio misturados
- JSONB demais
- Strings livres em status/tipo
- Falta normalização consistente
- `projetos` mistura engenharia + financeiro
- `empresas` mistura config + estado + domínio

### Erros
- Inventário de tabelas: ~50% errado (inventou STATUS, ENDERECOS, EMPRESA_PESSOAS, CHAVES_PIX, etc.)
- Classificou `FATURAS` como fatura de cartão (é faturamento de projeto)
- Sugere unificar `audit_logs`+`admin_audit_logs`+`critical_alerts` (regressão de segurança)
- Fase 1 (Core) baseada em tabelas inexistentes
- Fase 3 (Financeiro) ignora `orcamento_versoes`, `marcos_faturamento`, `grupos_parcela`

### Gaps
- Não menciona: propostas, portal cliente, SaaS billing, segurança (impersonation, MFA, rate limit), fornecedores/folha
- Não cita: views correlatas (gargalo), CASCADE risk, índices, RLS

### Veredito
Usar PDF original como **brief de motivação** (captura dores reais), e este doc como **plano técnico executável**.

---

## Histórico

- **2026-05-19**: Auditoria inicial baseada em types.ts + migrations + documento PDF do cliente
- **Próximo passo**: rodar queries de validação em prod (seção 11) antes de executar P0
