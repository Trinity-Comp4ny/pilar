# Achados de Segurança — Fluxos de Agente de IA (2026-07-13)

> Origem: debate da equipe de agentes sobre a Visão Agêntica. O `critico-red-team` verificou no código
> e encontrou 3 furos que **existem em produção hoje** — independentes da decisão sobre o copiloto.
> Confirmação por `rls-auditor` em andamento (ver seção final).

## Resumo

| # | Achado | Severidade | Existe hoje em prod? |
|---|---|---|---|
| A1 | RPC financeiro `aprovar_orcamento_agente` sem checagem de role | 🔴 Alta | Sim (fluxo pouco usado — IA nunca rodou, mas RPC exposto) |
| A2 | Gravações de agente via `service_role` (bypassa RLS); isolamento só por `.eq(empresa_id)` manual; sem checar role/feature no servidor | 🔴 Alta | Sim |
| A3 | Controle de custo por contagem de *requests* (não tokens) + `logAiUsage` falha-silenciosa | 🟠 Média | Sim (bloqueia pricing de créditos) |

---

## A1 — RPC de aprovação financeira sem gate de role 🔴

**Arquivo:** `supabase/migrations/20260610010000_aprovar_orcamento_agente.sql`

`aprovar_orcamento_agente` é `SECURITY DEFINER` com `GRANT EXECUTE ... TO authenticated`, e valida **apenas** que o run existe e `v_run.empresa_id = get_user_empresa_id()`. **Não valida role nem feature.**

- **Impacto:** um usuário `authenticated` qualquer da empresa — inclusive nível `viewer` em Financeiro — pode chamar via `supabase.rpc('aprovar_orcamento_agente', ...)` e materializar linhas em `projeto_orcamento_fases` (`valor_venda` = dinheiro). O front esconde o botão (`src/pages/revisao-ia/useAgentRuns.ts`), mas o RPC está exposto na rede.
- **Causa raiz:** a autorização de produto (`canDo` em `src/lib/permissions.ts`) é **client-side** — não protege o servidor. O RPC pula RLS (é SECURITY DEFINER) e não replica a checagem de role.
- **Correção mínima:** criar uma função SQL `has_feature_level(feature, level)` (equivalente server-side de `canDo`) e chamá-la dentro de todo RPC de agente que grava. 
- **Teste que confirma (1h):** logar como `viewer` e chamar o RPC via console. Se materializar as fases, está provado.

## A2 — Gravações via service_role sem RLS 🔴

**Arquivo:** `supabase/functions/ai-proposta-copilot/index.ts` (e padrão das demais `ai-*`)

Autentica o usuário, mas **todas as leituras/gravações usam `createAdminClient()` (service_role, bypassa RLS)**. O isolamento entre empresas depende de o desenvolvedor lembrar de escrever `.eq("empresa_id", empresaId)` em cada query. Nenhuma das 11 `ai-*` checa a feature-flag `ai_hub` nem role no servidor (grep por `ai_hub|role|canDo` nas funções = vazio).

- **Impacto:** hoje, com 1 agente e poucas queries, é revisável. A Visão pede "centenas de tools" — cada uma com service_role tendo que lembrar o filtro de tenant à mão, **sem RLS de rede de segurança**. Uma tool que esquece o filtro num `UPDATE` mexe no dinheiro de outra empresa. É um vetor de vazamento cross-tenant que escala com o nº de tools.
- **Correção mínima:** tools de domínio **não** devem usar service_role. Usar client com o JWT do usuário (RLS ativa) OU RPCs `SECURITY DEFINER` que checam empresa **e** role internamente (ver A1). service_role só para o que RLS legitimamente impede (ex.: logs).
- **Teste que confirma:** 1 tool de despesa que grava via client autenticado; confirmar que despesa de outra empresa é recusada **pela política RLS**, não pelo `.eq`.

## A3 — Controle de custo conta requests, não tokens 🟠

**Arquivo:** `supabase/functions/_shared/ai-client.ts`

`checkRateLimit` compara `total_requests >= limite_requests` (default 100, `000_base_schema.sql`). Um prompt agêntico (orquestrador + N agentes + M tools) é **1 request** mas queima muitos tokens. Além disso, `logAiUsage` é **falha-silenciosa** ("tabela pode não existir ainda") — por isso `ai_usage_logs` tem 0 linhas em prod.

- **Impacto:** o pricing de créditos (Camada 2) não fecha em cima de um contador de requests + logger que engole falhas. Ou não cobra (perde dinheiro), ou cobra errado (perde cliente).
- **Correção mínima:** medir custo por **token** e por **`agent_run` inteiro** (somar `ai_usage_logs` do run); tornar o log **não-silencioso** para fluxos que gravam; medir custo real de 20-30 execuções no MVP antes de fixar preço de crédito.

---

## Guardrails como Definition-of-Done (para qualquer fluxo de agente que grave)

1. Gate de role/feature **no servidor** (A1).
2. Gravação via RLS, não service_role; teste de recusa cross-tenant (A2).
3. Custo medido por token com log não-silencioso (A3).
4. Idempotência do write (evitar double-submit → lançamento em dobro — histórico conhecido no projeto).
5. Reversibilidade testada (botão desfazer real).
6. Eval mínimo (30 casos) antes de expor ao cliente — `agent_runs.confidence` existe e nunca é populada.

## Confirmação (verificação direta no código, 2026-07-13)

> O `rls-auditor` travou (watchdog); a confirmação abaixo foi feita por leitura direta do SQL.

**A1 — CONFIRMADO.** `20260610010000_aprovar_orcamento_agente.sql`: `SECURITY DEFINER` (linha 12), `GRANT EXECUTE ... TO authenticated` (linha 69). As únicas checagens são `v_run.empresa_id != v_empresa` (linha 27-28) e o status do run — **nenhuma checagem de role/feature**.

**Detalhe que facilita a correção:** as funções server-side **já existem** — `public.has_role(VARIADIC user_role[])` e `public.user_has_feature(p_feature text, p_min_level text)` (migrations `20260429700000` e `20260425000001`). Só não foram chamadas no RPC. Correção = adicionar no início do RPC, antes do INSERT:
```sql
IF NOT public.user_has_feature('financeiro', 'editor') THEN
  RAISE EXCEPTION 'Sem permissão para aprovar orçamento';
END IF;
```
Ou seja: a rede de segurança existe no banco; o RPC de agente simplesmente não a usa. Todo RPC de agente que grava deve chamar `user_has_feature`/`has_role`.

**A2 — procede (não re-verificado em detalhe aqui).** Recomendado confirmar quando o `rls-auditor` estiver disponível: se as `ai-*` usam `createAdminClient()` para gravar dados de domínio, o mesmo padrão de gate server-side (`user_has_feature`) deve entrar antes de qualquer INSERT/UPDATE, e preferir client autenticado (RLS) onde possível.
