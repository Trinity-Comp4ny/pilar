# Reúso Labrynth → Pilar

> Consolidação do aprendizado extraído dos repositórios internos da Labrynth
> (varredura de 2026-07-14), com o que vale **adaptar** para o Pilar.
> ← [voltar ao índice de arquitetura](./README.md)

**Como usar este doc:** é uma referência de porte, não uma cópia de código. Cada item aponta o
**arquivo-fonte** no repo da Labrynth (na máquina do dev, `~/Documents/Labrynth/…`) e diz **o que
adaptar**. Você puxa o código na hora de implementar, direto da fonte. Só os poucos contratos que
moldam decisão estão embutidos aqui.

**Regra de adaptação (Vue/Next → React+Vite do Pilar):**
- Lógica de negócio da Labrynth vive em **edge functions Deno + SQL/RLS** — idêntico à stack do Pilar,
  porta quase 1:1.
- Só a camada de tela muda: `.vue`/Server Components → `.tsx` no shadcn que o Pilar já tem.
- Trocar `next-intl` (`useTranslations('X')('key')`) por string PT-BR literal; `process.env.NEXT_PUBLIC_*` /
  `import.meta.env.VITE_*`; classes de token da Labrynth → tokens do Pilar em `src/styles/tokens.css`.

---

## Reconciliação com o backlog do founder (leia antes do Cluster 1)

O [`strategy/TODO_CONFIG_ADMIN_2026-07-14.md`](../strategy/TODO_CONFIG_ADMIN_2026-07-14.md) (consenso de 5
agentes) é a verdade de prioridade sobre admin. Ele diz: **o Pilar já tem superfície de admin demais**;
construir mais super-admin é **prematuro** (0 pagantes); o problema é **incoerência**, não falta de profundidade.

Portanto os padrões de "admin/tenancy" da Labrynth **não** entram como um portal de super-admin novo. Entram
como **ferramenta para o trabalho que o TODO já prioriza**:

| Padrão Labrynth | Onde aplica no TODO do founder | Prioridade |
|---|---|---|
| Convite com token aleatório, só o **hash** no banco | Fix do bug de portal auth (sha256 vs plaintext) | 🔴 |
| `_shared/admin-auth` que lê role **no banco**, não no token | Hardening edge functions (classe SEC-11) | 🔴 |
| Soft delete + **confirmar digitando o nome** | Guard destrutivo suspender/cancelar empresa (Bloco 1) | 🟠 |
| Helper RLS `get_role()`/`empresa_id()` + 3 perfis | 3 perfis de acesso Owner/Coordenador/Colaborador (Bloco 2) | 🔴 ICP |

**NÃO fazer** (o TODO congela): CRUD de empresas em super-admin novo, dashboard MRR/churn, observabilidade
multi-tenant, paginação de empresas, API keys.

---

## Contrato de papéis (fonte única, os clusters 1 e 3 seguem isto)

Os 3 perfis que o ICP exige (TODO Bloco 2). Backend (RLS) e frontend (guard/UI) usam os **mesmos nomes**:

| Papel (`role`) | Vê financeiro/folha/margem | Escopo |
|---|---|---|
| `owner` | Sim, tudo | Empresa inteira |
| `coordenador` | **Não** | Só projetos dele: horas, prazo |
| `colaborador` | **Não** | Só a tarefa dele; lança hora |

Papel mora em `profiles.role` **e** em `app_metadata.role` do JWT (barato e à prova de spoofing na RLS).

---

## Cluster 1 — Segurança & tenancy (edge functions + SQL/RLS)

Fonte: `~/Documents/Labrynth/frontend` (Vue + Supabase) e `~/Documents/Labrynth/local-aid-eng474` (Next + Supabase).

### 1.1 Convite com hash (fix de portal auth) — 🔴
- Fonte: `local-aid-eng474/web/src/lib/invites/tokens.ts` (`generateInviteToken`/`hashInviteToken`/`isValidInviteToken`).
- Adaptar: mover para Deno (edge function), gerar token aleatório, enviar por e-mail, guardar **só o hash** +
  TTL + status (`pending/accepted/revoked`). Aceite compara hash.
- Porta direto (~horas).

### 1.2 `_shared/` das edge functions — 🔴
- Fonte: `frontend/supabase/functions/_shared/{admin-auth,cors,audit,rate-limit}.ts`.
- Contrato de `admin-auth.ts` (o ativo mais valioso):
  ```ts
  // autentica JWT, busca role NO BANCO (não confia no token), checa deleted_at
  requireRole(req): Promise<{ adminSupabase, userId, role, empresaId } | { error: Response }>
  ```
- `cors.ts` fail-closed com allowlist + `Vary: Origin` + security headers (resolve "CORS sem domínio staging").
- `rate-limit.ts` conta linhas do audit log numa janela deslizante (audit serve dobrado de rate limiter).
- Porta quase drag-and-drop (Deno = Deno), ajustando nomes de tabela.

### 1.3 RLS helpers + 3 perfis — 🔴 ICP
- Fonte: `local-aid-eng474/supabase/migrations/20250601000002_rls_policies.sql`.
- Padrão: funções `SECURITY DEFINER STABLE` `get_user_role()` / `my_empresa_id()`, usadas em toda policy.
  Colunas financeiras filtradas por `role = 'owner'`.
- Pilar já tem base multi-tenant (ADR 0001) e permissões em 2 níveis (ADR 0005) — isto **endurece**, não refaz.
- Migration nova: usar número **≥ 027** (evita colisão com Cluster 5).

### 1.4 Guard destrutivo + soft delete — 🟠
- Fonte: `frontend` RPC `admin_soft_delete_company` (valida `confirm_name` digitado, cascateia, bane auth).
- Aplicar em suspender/cancelar empresa (`ultra-admin/index.tsx:849-870`, hoje só banner amarelo).

---

## Cluster 2 — Frontend patterns (React/shadcn)

Fonte: `~/Documents/Labrynth/rti-global` (mesma família de stack; ignorar RTI-US/Canada, são template puro).

### 2.1 `RankingTable` + contrato de dados — resolve "queries que mascaram falha"
- Fonte: `rti-global/src/components/shared/RankingTable.tsx` + `src/types/country.ts`.
- Contrato que **obriga** propagar erro até a UI:
  ```ts
  type DataSourceResult<Row> = { rows: Row[]; isPending?: boolean; error?: Error | null }
  // a tabela EXIGE error/loading como props e RENDERIZA o erro (não engole)
  ```
- Tabela config-driven com loading (skeleton) / empty / **error** embutidos, sort client-side, colunas sticky.
- Adaptar: remover `next-intl`, mapear tokens. Esforço médio.

### 2.2 `useFormPersist` — rascunho de form em localStorage (TTL 24h)
- Fonte: `rti-global/src/hooks/useFormPersist.ts`. Ganho imediato nos forms longos (proposta/projeto/aditivo).
- Porta direto.

### 2.3 Primitivas de form (validação onBlur + sucesso + Honeypot)
- Fonte: `rti-global/src/components/forms/_primitives/`.
- Padrão de validação no `onBlur` + check verde de sucesso + `Honeypot` anti-spam, acessível
  (`aria-invalid`/`role="alert"`). Enxertar no shadcn Form existente.

### 2.4 Validador de e-mail corporativo no Lead
- Fonte: `rti-global/src/lib/emailValidator.ts` (blocklist ~50 domínios grátis, inclui `.com.br`).
- Marcar lead com e-mail pessoal. Porta direto (trivial).

---

## Cluster 3 — RBAC no cliente + erros

Fonte: `~/Documents/Labrynth/local-aid-eng474`.

### 3.1 `<RequireRole>` + mapa papel→rota
- Fonte: `web/src/lib/auth/role-dashboard.ts` (mapa único `ROLE_DASHBOARD`) + `web/src/lib/dal.ts` (`requireRole`).
- Adaptar (Vite/CSR, sem Server Component): `<RequireRole roles={[...]}>` lê o `AuthContext`, faz
  `<Navigate to={dashboardForRole(role)}>`. A **segurança real** fica na RLS (Cluster 1); o guard de UI é UX.
- Consome o [contrato de papéis](#contrato-de-papéis-fonte-única-os-clusters-1-e-3-seguem-isto).

### 3.2 `lib/errors.ts` — extração de erro PostgREST
- Fonte: `local-aid-eng474/web/src/lib/errors.ts`.
- Extrai `.message` do formato PostgREST (objeto, não `Error`). ~30 linhas, zero dep. Cura os toasts genéricos.

---

## Cluster 4 — Design system / motion

Fonte: `~/Documents/Labrynth/DESIGN-SYSTEM.md` + `~/Documents/Labrynth/labrynth-website/`.
Nota: o método de tokens em 2 camadas (primitivo→semântico) **o Pilar já tem** em `src/styles/tokens.css`.
Não refazer. Preencher só as 2 lacunas + polish.

### 4.1 Tokens de motion (lacuna) — barato, alto retorno
- Fonte: `labrynth-website/app/globals.css` (`:root`).
  ```css
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 300ms; --dur-base: 500ms; --dur-slow: 700ms;
  ```
- Adotar como tokens + desligar decoração em `@media (prefers-reduced-motion: reduce)` (regra de review).
  Curvas de easing não têm cor — porta apesar de marca diferente.

### 4.2 Tipografia fluida `clamp()` (lacuna) — só landing e títulos de módulo
- Fonte: `labrynth-website/components/ui/styles/theme.css` (`--text-h1: clamp(...)`).
- **Não** aplicar densidade fluida a tabelas financeiras (app de dados quer densidade previsível).
- Pilar está em Tailwind v3: replicar via `@layer`/plugin (font-size + line-height juntos). Se entrar tipografia
  custom, precisa do truque `extendTailwindMerge` (`labrynth-website/components/ui/lib/cn.ts`) senão o merge
  descarta o tamanho.

### 4.3 Componentes + polish
- `Heading.tsx` (tag semântica `as` desacoplada do tamanho visual `size`), `Section`/`Container` (ritmo/gutter
  fluidos). Fonte: `labrynth-website/components/ui/components/`.
- Sheen + foco premium no Button do shadcn (via `::before`, `motion-reduce:before:hidden`).

---

## Cluster 5 — Arquitetura de IA / agentes

Fonte: `~/Documents/Labrynth/platform` (GraphRAG + pipeline de compliance), `patent-intelligence`, `pmd-mvp`.
Ressalva: Celery/Neo4j/Django/pydantic-graph **não** importar — os mesmos conceitos saem com fila no Postgres +
pgvector + máquina de estados nas edge functions.

### 5.1 Pipeline multi-estágio idempotente com cache no banco
- Fonte: `platform/labrynth/code_compliance/orchestrator.py`, `platform/AGENTS.md`.
- Regra de ouro: cada estágio lê do DB, nunca da memória do anterior; constraint de unicidade = chave de cache.
  Certo para edge functions (timeout curto): análise longa quebrada em etapas retomáveis.

### 5.2 Agentic RAG com citações rastreáveis
- Fonte: `platform/labrynth/chatbot/services/graphrag_service.py`, `chatbot/schemas.py`.
- Retrieval como **tool** (o modelo decide quando buscar, com budget máx) + saída estruturada com
  `cited_references` no formato exato + score mínimo de relevância. Blueprint da branch `feat/ai-chat-consultivo`.

### 5.3 Supabase-as-bus (job queue via `pg_notify` + Realtime)
- Fonte: `patent-intelligence/docs/architecture.md`, `python/src/worker/listener.py`.
- Tarefa longa: front escreve numa tabela `jobs`, worker/edge consome via `pg_notify` (fallback polling), front lê
  progresso via Realtime. Barra de progresso de graça, sem segurar a request. Migration nova: número **≥ 030**.

### 5.4 Custo de IA como "equivalente-humano"
- Fonte: `platform/…/agents/core.py` (`agent_context` registra rate/hora e horas-pessoa por execução).
- Alimenta `ai_usage_logs` e o pricing por créditos; dá narrativa de venda.

---

## Sequência de maior ROI (síntese)

1. Cluster 1 — fix token de convite + `_shared/` hardening + RLS helpers/3 perfis (segurança + ICP).
2. Cluster 2 — `useFormPersist`, contrato `{rows,isPending,error}`+`RankingTable`, `lib/errors`, `emailValidator`.
3. Cluster 3 — `<RequireRole>` + mapa papel→rota (consome o contrato de papéis).
4. Cluster 4 — tokens de motion + `prefers-reduced-motion` (barato).
5. Cluster 5 — ADR + scaffolding (job queue + `ai_usage_logs`); RAG citável junto do chat consultivo.
