# Plano de Melhorias — Sprint 2026-05

> Gerado em 2026-05-13 após análise de mesa redonda com 10+ agentes especializados.  
> Implementação paralela em 6 worktrees, mergeada em `staging` em 2026-05-13.

> **Atualização 2026-05-19**: ICP refinado e plano executável de 4 semanas em [ICP_E_PLANO_DESIGN_PARTNER_2026-05.md](./ICP_E_PLANO_DESIGN_PARTNER_2026-05.md). Auditoria de código revelou que Timesheet está MUITO mais avançado do que listado em P4 abaixo — migration aplicada, página/dialog/hook prontos. Falta ativar feature flag e integrar com margem.

---

## Status Geral

| Stream | Escopo | Status |
|--------|--------|--------|
| DB | Migrations de performance e RPCs | ✅ Mergeado |
| Edge Functions | Segurança e onboarding | ✅ Mergeado |
| Frontend Nav | Sidebar + rentabilidade em projetos | ✅ Mergeado |
| Frontend Comp | QuickLancamento, BudgetActual, SmartInvoice | ✅ Mergeado |
| Performance | Lazy loading, pagination | ✅ Mergeado |
| Tests | E2E Playwright fixtures + 5 specs | ✅ Mergeado |

Build: `npm run build:strict` ✅ Zero erros de tipo.

---

## O Que Foi Entregue

### DB (4 migrations)
- `idx_receitas/despesas/projetos/marcos` — índices parciais `WHERE deleted_at IS NULL`
- `get_financial_chart_data(empresa_id, inicio, fim)` — agrega dados mensais server-side (elimina 10k rows → JS)
- `v_budget_vs_actual` — view por disciplina (horas reais = 0 até Timesheet existir)
- `rpc_custo_real_projeto(projeto_id)` — custo real = fases estimadas + despesas diretas

### Edge Functions (5 correções críticas)
- `pilar-checkout-webhook`: invite assíncrono com retry via `invite_dispatched_at NULL`; `trial_ends_at = NOW() + 14d`
- `asaas-webhook`: guard `empresa_id` no lookup de receita (previne cross-tenant leak)
- `invite-user`: check `max_usuarios` antes de criar invite (HTTP 422 se cheio)
- `create-company-owner`: trial_ends_at inicializado no signup
- `_shared/ai-client.ts`: `logAiUsage()` helper para rastrear tokens por empresa

### Frontend — Navegação e Projetos
- Sidebar: Timesheet, Capacidade, Templates, AI Hub (grupo "Inteligência") adicionados
- Feature key `"timesheet"` adicionada em `features.ts` como dormant/addon
- Card "Resultado do Projeto" em `ProjetoDetailInfo`: receitas, custo estimado, margem %
- Badge "⚠ Margem baixa" em `ProjectCard` quando conclusão > 80% e margem < 15%
- Página `Timesheet.tsx` — placeholder "Em breve"

### Frontend — Componentes
- `QuickLancamentoDialog` + FAB `FloatingQuickAdd` (mobile, bottom-right)
- `BudgetActualCard` — horas por disciplina com progress bar (0% até Timesheet)
- `SmartInvoiceDialog` — 3 modos: parcelas mensais, por marcos, manual; integrado pós-conversão de proposta

### Performance
- `DashboardFinanceChart` e `RechartsComponents` extraídos como lazy chunks
- 6 abas do Financeiro convertidas para `lazy()` + `<Suspense>`
- `useClientesPaginados` — `useInfiniteQuery` com pageSize + searchTerm
- `useLeadsPaginados` — `useInfiniteQuery` com pageSize + searchTerm + statusFilter

### Testes E2E
- `e2e/fixtures/auth.ts` — `authenticatedPage` + `adminPage` fixtures (guard anti-produção)
- `e2e/login.spec.ts` — credenciais inválidas, Zod validation, redirect pós-login
- `e2e/financeiro-basico-authenticated.spec.ts` — criar receita, verificar KPI
- `e2e/projeto-fluxo-authenticated.spec.ts` — wizard projeto, smoke kanban
- `e2e/portal-cliente-autenticado.spec.ts` — página de login portal, redirect sem sessão
- `e2e/sidebar-navigation-authenticated.spec.ts` — 8 rotas principais sem crash

---

## Pendências (Ordenadas por Impacto)

### 🔴 Crítico — Fazer Logo

| # | Item | Por quê |
|---|------|---------|
| P1 | **`npm run gen:types`** após aplicar migrations no Supabase remoto | Types defasados |
| P2 | **Migration `ai_usage_logs`** | `_shared/ai-client.ts` já referencia a tabela |
| P3 | **Conectar RPC `get_financial_chart_data`** ao `useFinanceData.ts` | Backend pronto, frontend ainda usa query bruta |

### 🟠 Alta Prioridade — Próximo Sprint

| # | Item | Detalhes |
|---|------|----------|
| P4 | **Timesheet MVP** | Módulo do zero: form de lançamento, listagem por projeto, aprovação. North star do produto |
| P5 | **Trial expiry** | E-mails D-7/D-3/D-0; bloquear acesso após expirar |
| P6 | **Asaas UI MVP** | Config screen + botão "Gerar cobrança" na tela de fatura |

### 🟡 Médio Prazo

| # | Item | Detalhes |
|---|------|----------|
| P7 | **PLAN_FEATURES mapping** | Mapear plano slug → features permitidas |
| P8 | **Portal: aprovar + pagar** | Fluxo completo de aprovação de proposta no portal cliente |
| P9 | **Materialized view rentabilidade** | Discussão no plano, não implementada; necessária quando Timesheet existir |
| P10 | **Relatório semanal auto** | Edge function + e-mail com snapshot financeiro da semana |

### ⚪ Segurança em Aberto (da auditoria 2026-04-29)
Ver `audit_security_open.md` — S1-S8 (segurança) e D1-D7 (integridade) ainda não corrigidos.

---

## Decisões Técnicas Registradas

- `custo_estimado` em `projeto_orcamento_fases` é `GENERATED ALWAYS AS` — não pode ser inserido diretamente
- Timesheet não existe ainda — todo `horas_reais` retorna 0 até ser construído
- AI Hub (11 edge functions Gemini) existe no backend, sem UI — não vender como diferencial ainda
- Asaas backend pronto, sem UI — idem
- `invite_dispatched_at` NULL = convite pendente de reenvio (cron pode pegar)
