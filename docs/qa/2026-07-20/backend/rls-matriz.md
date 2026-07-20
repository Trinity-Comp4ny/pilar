# QA de Segurança — Matriz de RLS (banco LOCAL, via API real)

Data: 2026-07-17 · Ambiente: Supabase local (`rizaklgstyfrwgmdsldf`), PostgREST em `http://127.0.0.1:54331/rest/v1`.
Método: JWT por usuário via `/auth/v1/token` (senha `Pilar@2026`) e requisições REST diretas com `Authorization: Bearer <token>`. Nenhum browser. Policies e funções inspecionadas via `docker exec ... psql`.

Usuários (empresa Pilar Local `937f6812-e91c-4747-a345-b98f0bba0d41`):

| user | sub | role | features do profile (granular) |
|---|---|---|---|
| admin | 8e782f85… | admin | tudo `editor` |
| owner | 1111… | owner | tudo `editor` (owner faz bypass do gate granular) |
| coord | 2222… | coordenador | mapa/leads/clientes/projetos/dashboard/propostas/timesheet/relatorios — **sem financeiro** |
| colab | 3333… | colaborador | projetos(viewer)/dashboard(viewer)/timesheet(editor) — **sem financeiro** |

Empresa de controle criada e removida ao final: `QARLS-Empresa-Teste` (`aaaaaaaa-…-000000000001`) com cliente, projeto, receita, despesa, conta, lead e folha "secretos".

---

## Como o modelo funciona

- Toda tabela tem RLS ligado (64/64).
- `get_user_empresa_id()` resolve a empresa do `auth.uid()`. Isolamento por empresa é o predicado base.
- Tabelas financeiras "boas" usam `user_has_feature('financeiro','viewer'|'editor')`, que lê `profiles.features` (JSONB granular por usuário) e exige a feature ligada na empresa.
- **O gate financeiro depende inteiramente de `profiles.features`.** Quem controla esse JSONB controla o acesso (ver ACH-RLS-01).

---

## 1. Isolamento entre empresas (teste crítico de vazamento)

Para cada tabela, cada usuário da Pilar tentou ler a linha específica da empresa QARLS por `id=eq.<qarls_id>`.

| Tabela | admin | owner | coord | colab | Veredito |
|---|---|---|---|---|---|
| clientes | none | none | none | none | ✅ |
| projetos | none | none | none | none | ✅ |
| receitas | none | none | none | none | ✅ |
| despesas | none | none | none | none | ✅ |
| contas | none | none | none | none | ✅ |
| leads | none | none | none | none | ✅ |
| folha_pagamento | none | none | none | none | ✅ |

**Nenhum vazamento entre tenants.** Nenhum usuário da Pilar enxergou qualquer linha da QARLS em nenhuma tabela. O predicado `empresa_id = get_user_empresa_id()` segura. `empresa_id` do próprio profile não pode ser trocado (trigger `tg_prevent_profile_tampering` bloqueia, só `ultra_admin` muda). ✅

---

## 2. RLS por role dentro da empresa (leitura)

Contagem visível (own company) por role. coord e colab **não** têm a feature `financeiro`.

| Tabela | gate na policy | admin | owner | coord | colab | Veredito |
|---|---|---|---|---|---|---|
| receitas | feature financeiro/viewer | ✅lê | ✅lê | 0 (bloq) | 0 (bloq) | ✅ correto |
| despesas | feature financeiro/viewer | ✅ | ✅ | 0 | 0 | ✅ |
| contas | feature financeiro/viewer | ✅ | ✅ | 0 | 0 | ✅ |
| cartoes | feature financeiro/viewer | ✅ | ✅ | 0 | 0 | ✅ |
| categorias_financeiras | feature financeiro/viewer | ✅ | ✅ | 0 | 0 | ✅ |
| fornecedores | feature financeiro/viewer | ✅ | ✅ | 0 | 0 | ✅ |
| marcos_faturamento | feature financeiro/viewer | ✅ | ✅ | 0 | 0 | ✅ |
| **faturas** | **só empresa_id (SEM feature)** | lê | lê | **lê 4** | **lê 4** | 🟠 ACH-RLS-02 |
| **folha_pagamento** | **só empresa_id (SEM feature)** | lê | lê | **lê** | **lê** | 🔴 ACH-RLS-03 |
| **transferencias** | **só empresa_id (SEM feature)** | lê | lê | **lê** | **lê** | 🟠 ACH-RLS-04 |
| **centros_custo** | **só empresa_id (SEM feature)** | — | — | lê | lê | 🟠 ACH-RLS-04 |
| **lancamento_rateios** | **só empresa_id (SEM feature)** | — | — | lê | lê | 🟠 ACH-RLS-04 |

## 2b. RLS por role (escrita) — testado via API

| Op | tabela | user | resultado | Veredito |
|---|---|---|---|---|
| INSERT | receitas | colab | 403 RLS violation | ✅ (controle, gate funciona) |
| UPDATE | faturas | colab | 200 mas **0 linhas** afetadas | ✅ (write gated por editor) |
| **UPDATE** | **folha_pagamento** | **colab** | **200, salário alterado p/ 999999** (revertido) | 🔴 ACH-RLS-03 |
| **INSERT** | **centros_custo** | **colab** | **201 criado** (removido) | 🟠 ACH-RLS-04 |
| INSERT | folha_pagamento | colab | passou RLS, falhou só em FK (pessoa_id) | 🔴 ACH-RLS-03 |
| INSERT | lancamento_rateios | colab | passou RLS, falhou só em NOT NULL | 🟠 ACH-RLS-04 |

---

## 3. Portal (portal_entregas / cliente_portal_accounts)

| Ação | resultado | Veredito |
|---|---|---|
| anon lê portal_entregas | `[]` (bloqueado) | ✅ (relacionado ao ACH-PORT-01) |
| anon lê cliente_portal_accounts | `[]` | ✅ |
| anon qualquer tabela | 401 "Empty JWT" | ✅ |
| admin (staff) lê portal_entregas | ✅ lê | ✅ |
| colab lê cliente_portal_accounts | `[]` (precisa portal_cliente/editor) | ✅ |
| **admin lê cliente_portal_accounts com `select=*`** | **retorna `senha_hash` (bcrypt) E `token_sessao` (token de sessão ativo) E `token_expira_em`** | 🟠 ACH-RLS-05 |

## 4. profiles / empresas / convites

| Ação | resultado | Veredito |
|---|---|---|
| colab PATCH próprio `role` → owner | **bloqueado** (trigger `tg_prevent_profile_tampering`: "alteração de role não autorizada") | ✅ ACH-AUTH-10 fechado p/ role |
| colab PATCH próprio `empresa_id` | bloqueado (mesmo trigger) | ✅ |
| **colab PATCH próprio `profiles.features` → adiciona `financeiro:editor`** | **200 SUCESSO** | 🔴 **ACH-RLS-01** |
| colab lê todos os profiles da empresa (roles+features) | ✅ lê os 4 | ⚪ aceitável (mesma empresa) |
| colab PATCH profile de OUTRO usuário (owner→colaborador) | 200 mas **0 linhas** (bloqueado) | ✅ |
| colab lê própria empresa | ✅ | ⚪ ok |
| colab PATCH `empresas` (nome→HACKED) | 200 mas **0 linhas** (bloqueado) | ✅ |
| colab lê convites | `[]` (bloqueado) | ✅ |

## 5. Tabelas sensíveis e RPC

| Alvo | colab | anon | Veredito |
|---|---|---|---|
| convites, admin_audit_logs, audit_logs, mfa_backup_codes, impersonation_sessions, ai_usage_logs, agent_runs, pilar_subscriptions | `[]` (bloqueado em todas) | 401 | ✅ |
| RPC `aprovar_orcamento_agente` (colab) | **"Sem permissão para aprovar orçamento"** | — | ✅ A1 fechado |
| RPC `aprovar_orcamento_agente` (owner) | passa o gate → "Run não encontrado" | — | ✅ gate + tenancy presentes |

RPC tem `IF NOT user_has_feature('financeiro','editor') THEN RAISE` + checagem `empresa_id`/`projetos`. A2 (ai-* via service_role) não é testável por API com JWT de usuário (roda fora do RLS por design).

---

# Achados

## 🔴 ACH-RLS-01 — Colaborador escala o próprio acesso via PATCH em `profiles.features` (CRÍTICO)

O que é a raiz de tudo. A policy `Usuario edita seu profile` permite `UPDATE ... WHERE id = auth.uid()`. O trigger `tg_prevent_profile_tampering` bloqueia mudança de `role` e `empresa_id`, **mas NÃO bloqueia `features`**. O trigger `tg_validate_features_subset` só valida que as features são subconjunto das da empresa.

Resultado: um `colaborador` faz
```
PATCH /rest/v1/profiles?id=eq.<seu_id>
{"features":{"financeiro":"editor", ...}}
```
recebe 200, e imediatamente passa a **ler e escrever** todas as tabelas financeiras gated (confirmado por API: após o PATCH, colab leu receitas/despesas/contas/cartoes e **inseriu uma receita, HTTP 201**). Também poderia se conceder `portal_cliente:editor` e ler `cliente_portal_accounts` (hashes + tokens — ver ACH-RLS-05), ou satisfazer o gate do RPC `aprovar_orcamento_agente`.

Impacto: **o controle de acesso por feature inteiro é contornável por qualquer usuário autenticado**, com um único request. A barreira de role no financeiro é efetivamente só de UI.

Correção: o trigger de anti-tampering deve tratar `features` como campo privilegiado — só `admin`/`owner`/`ultra_admin` (via `current_effective_role()`, como já faz a policy `profiles_admin_manage`) podem alterar `features` de qualquer profile, inclusive o próprio. A policy de self-edit deve permitir só campos não-privilegiados (nome, contato, avatar, onboarding).

## 🔴 ACH-RLS-03 — `folha_pagamento` sem gate de role: colaborador lê E escreve a folha (CRÍTICO)

Todas as policies de `folha_pagamento` (SELECT/INSERT/UPDATE/DELETE) checam **apenas** `empresa_id = get_user_empresa_id()`, sem `user_has_feature`. Confirmado por API: `colab` e `coord` leem a folha, e `colab` deu **UPDATE alterando o salário para 999999** (HTTP 200, revertido). Qualquer autenticado da empresa lê e adultera salários. Correção: alinhar ao padrão das demais financeiras (`user_has_feature('financeiro', ...)`).

## 🟠 ACH-RLS-02 — `faturas` legível sem a feature financeiro

`faturas_select` só checa `empresa_id` (sem feature). `coord` e `colab` leem as 4 faturas de cartão. A escrita é gated (UPDATE de colab afetou 0 linhas). Vaza dado financeiro (valores de fatura) por leitura. Correção: adicionar `user_has_feature('financeiro','viewer')` ao SELECT.

## 🟠 ACH-RLS-04 — `transferencias`, `centros_custo`, `lancamento_rateios` sem gate de role

Policies só por `empresa_id`, todas as operações. Confirmado: `colab` inseriu em `centros_custo` (201) e lê `transferencias`/`lancamento_rateios`; RLS deixou passar INSERT em `lancamento_rateios` (falhou só em NOT NULL). São tabelas financeiras (movimentação entre contas, rateio de lançamentos, centros de custo). Correção: mesmo gate de feature das demais.

## 🟠 ACH-RLS-05 — `cliente_portal_accounts` expõe `senha_hash` e `token_sessao` via SELECT

PostgREST não tem RLS por coluna. Qualquer staff com `portal_cliente` (e, via ACH-RLS-01, qualquer colaborador que se auto-conceda) lê `senha_hash` (bcrypt) e, pior, `token_sessao` (token de sessão ativo do portal do cliente) e `token_expira_em` num `select=*`. Um token de sessão vazado permite sequestrar a sessão do cliente no portal. Correção: mover `senha_hash`/`token_sessao` para tabela separada sem SELECT para authenticated, ou usar uma view/coluna revogada (GRANT por coluna), servindo o portal só via edge function com service_role.

---

# Resumo executivo

- **Vazamento entre empresas: NÃO.** Isolamento por `empresa_id` sólido em todas as tabelas testadas; `empresa_id` do profile é imutável para não-ultra_admin. ✅
- **Colaborador lê/escreve financeiro: SIM, em duas frentes.**
  1. Direto, nas tabelas sem gate de feature: **folha_pagamento (lê + escreve salário)** 🔴, faturas (lê) 🟠, transferencias/centros_custo/lancamento_rateios (lê + escreve) 🟠.
  2. Indireto e total: **auto-concede `financeiro:editor` via PATCH no próprio profile** e destrava tudo (receitas/despesas/contas/cartoes, inclusive INSERT) 🔴 ACH-RLS-01.
- **Achado mais grave: ACH-RLS-01** — a escalada por `profiles.features` derruba o modelo inteiro de permissão por feature. Corrigir isso é pré-requisito; enquanto existir, os gates de feature das outras tabelas são teatro.
- **Bem feito:** role/empresa_id imutáveis no profile; RPC `aprovar_orcamento_agente` com gate A1 + tenancy; anon totalmente barrado; tabelas de auditoria/MFA/impersonation/convites invisíveis a colaborador; escrita em faturas e em profiles/empresas de terceiros bloqueada.

Dado de teste QARLS removido; features do colab revertidas ao seed original (verificado).
