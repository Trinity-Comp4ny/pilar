# Scorecard de maturidade — as 36 boas práticas × estado real do código

← [voltar ao índice](./README.md) · 2026-08-12 · Status: **diagnóstico, orienta priorização**

Origem: releitura dos três docs de ideias que o Matheus guardou em julho
([Product Experience](./PRODUCT_EXPERIENCE_MODULE.md), [Level-up do número](./LEVEL_UP_CONFIANCA_NUMERO.md),
[Home/Launchpad](./HOME_LAUNCHPAD_IDEA.md)), cruzada com uma recon read-only do
estado real do código em 2026-08-12 (três varreduras: infra de engenharia, UX de
produto, número confiável/onboarding/admin).

A conclusão de uma linha: **a maioria das 36 práticas já existe**. O sistema
subiu de nível desde julho. O que falta não é um mês de trabalho, é uma lista
curta de buracos específicos, e alguns deles são "ligar código que já está
escrito e morto no repo".

---

## Como ler o scorecard

- ✅ **EXISTE** — implementado e em uso.
- 🟡 **PARCIAL** — existe em parte do produto, ou existe mas com defeito/inconsistência.
- ⚪ **NÃO EXISTE** — não está no código (ou está órfão, o que dá no mesmo para o usuário).
- ⏸️ **PREMATURO** — decisão consciente de não fazer agora (teatro de maturidade para o estágio).

Esforço: 🟢 baixo (horas) · 🟡 médio (dias) · 🔴 alto (semana+ ou módulo inteiro).

---

## A. Experiência e polimento de UI

| # | Prática | Estado | Evidência / buraco |
|---|---------|--------|--------------------|
| 1 | Empty states com ação | 🟡 PARCIAL | `src/components/EmptyState.tsx` é bom (ícone, título, CTA, `role="status"`), usado em ~28 telas. Mas ~30 telas ainda têm "Nenhum..." como texto solto sem CTA (leads, pessoas). |
| 2 | Skeletons / loading | ✅ EXISTE | `PageSkeleton`, `TableSkeleton`, `ProjetoCardSkeleton` + skeleton shadcn. 133 arquivos com loading. Skeleton na tela, spinner no botão: mistura certa. |
| 3 | Erro com próximo passo | 🟡 PARCIAL | Infra central existe (`src/lib/errors.ts`, `safeError.ts`, `authErrors.ts`). Mas muita msg genérica ("Erro ao salvar X") e `error.message` cru vazando ao usuário em ultra-admin e Projetos. |
| 4 | Undo em delete | 🟡 PARCIAL | Padrão bom (soft-delete + toast "Desfazer") só em fornecedores, propostas e chat. Leads e Projetos deletam sem undo. |
| 5 | Confirmação de destrutivo | ✅ EXISTE | `ConfirmDialog` + AlertDialog em ~20 telas. Consistente. |
| 6 | Toast unificado | 🟡 PARCIAL (bug) | **Dois sistemas convivem.** Sonner é o montado (`App.tsx`). Mas 6 arquivos ainda usam `useToast` do shadcn, cujo `<Toaster>` **não está montado** → esses toasts provavelmente não aparecem. Bug silencioso. |
| 7 | Microcopy consistente | 🟡 PARCIAL | Mistura Title Case vs sentence case em botões da mesma família: "Novo projeto" (certo) vs "Novo Fornecedor"/"Nova Disciplina" (destoa da regra da marca). |
| 8 | Acessibilidade básica | ✅ EXISTE | Radix por baixo (foco preso, ESC, aria), 205 `aria-label`, `role`/`aria-hidden` no EmptyState. Base sólida. |
| 9 | Command palette (⌘K) | ⚪ ÓRFÃO | `CommandPalette.tsx` + `useCommandPalette.ts` + `command.tsx` **existem e são completos**, mas **não estão montados em lugar nenhum**. Código morto: o ⌘K não funciona hoje. |
| 10 | Busca global | ⚪ NÃO EXISTE | Só existiria via o command palette órfão. |
| 11 | Recentes / favoritos | ⚪ NÃO EXISTE | Precisa tracking (`user_recent_items` ou localStorage). Ideia no doc Home/Launchpad. |

## B. Onboarding e ativação

| # | Prática | Estado | Evidência / buraco |
|---|---------|--------|--------------------|
| 12 | Setup obrigatório de conta | ✅ EXISTE | `PrivateRoute` encadeia profile-setup → company-setup → MFA, dirigido por `onboarding_completed`. |
| 13 | Checklist de primeiros passos | ✅ EXISTE | `OnboardingChecklist.tsx`: 6 passos dirigidos por contagem real no banco (cadastrar pessoa/cliente/lead/proposta/projeto/convidar), barra de progresso, dismiss persistido. |
| 14 | Tour guiado / tooltips contextuais | ⚪ NÃO EXISTE | Nenhum Shepherd/Joyride/Driver. |
| 15 | What's New / release notes in-app | ⚪ NÃO EXISTE | Decisão consciente: com 1 design partner, WhatsApp entrega o mesmo. Guardar esqueleto (`product_releases`). |
| 16 | Central de novidades / changelog público | ⚪ NÃO EXISTE | Mesmo raciocínio, escala com nº de clientes. |

## C. Confiança no número (o eixo do ICP)

| # | Prática | Estado | Evidência / buraco |
|---|---------|--------|--------------------|
| 17 | Drill-down do número | 🟡 PARCIAL | `useRentabilidade` é sólido, mas a margem/lucro do projeto **não abre as linhas que a compõem**: `Rentabilidade.tsx` mostra totais sem `onClick`, e não há RPC de detalhe. Drill só nos KPIs de Lançamentos. **É o item nº1 do doc Level-up e continua aberto.** |
| 18 | Export (PDF/CSV/Excel) | ✅ EXISTE | Relatórios exporta CSV/PDF/XLSX real (`relatorioExport.ts`, jsPDF + PizZip evitando o CVE do SheetJS), Auditoria exporta CSV, Folha gera comprovante PDF. Financeiro operacional exporta via Relatórios. |
| 19 | Import de dados | ✅ EXISTE | Spec 017 codada e deployada: extrato/fatura PDF por IA + CSV/Excel determinístico (`ImportarLancamentosDialog`, `ai-import-financeiro`) + import de cotações. Falta só import em massa de projetos/clientes. |
| 20 | Freshness visual ("atualizado há X") | ⚪ NÃO EXISTE | O dado **já é atualizado em background** (staleTime 2min, refetch 5min), mas nada disso aparece na tela. Nenhum `formatDistanceToNow`/`dataUpdatedAt` na UI. Prova de frescura invisível. |
| 21 | Permissões aplicadas (RBAC) | ✅ EXISTE | 37 arquivos usam `usePermissions.can()`/`useFeatureAccess`. `getButtonProps` desabilita + tooltip, `getNavItemProps` esconde menu. |
| 22 | Permissão granular (margem só pra sócio) | ⚪ NÃO EXISTE | O gate é por módulo `financeiro`, não por sensibilidade de linha. Não há `can("rentabilidade")` separado. Trava vender pra escritório com estagiário. |
| 23 | Audit trail | ✅ EXISTE | Dois níveis: `audit_logs` (trigger em 16 tabelas, diff old/new) + `admin_audit_logs` (ações de admin). UI read-only com filtros e export CSV (`admin/tabs/Auditoria.tsx`). |

## D. Infra de engenharia e release

| # | Prática | Estado | Evidência / buraco |
|---|---------|--------|--------------------|
| 24 | CI com gates | ✅ EXISTE | `ci.yml`: lint, typecheck, test, build, bundle-budget, `npm audit`, gitleaks, migrations do zero + **pgTAP de RLS**, **`types-sync` que bloqueia merge**, `deno check` nas edge functions. Maduro. |
| 25 | Cobertura de teste com piso | 🟡 PARCIAL | 40 arquivos de teste, financeiro coberto na lógica (folhaCalc, buildLancamentoPayload, rentabilidade, schemas). Mas **sem piso de cobertura** e páginas-deus (700-1400 linhas) sem teste de render. Fase 3 do plano prevê `@vitest/coverage-v8`. |
| 26 | Validação de fronteira (zod) | ✅ EXISTE | `src/schemas/` central, forms com zod, edge functions com `_shared/schemas.ts` + `parseOr400`, e **`src/lib/env.ts` valida env no boot** (padrão-ouro, com teste). |
| 27 | Feature flags | ✅ EXISTE | Três eixos (`empresas.features`, `profiles.features`, `feature_catalog`) resolvidos em `features.ts`/`permissions.ts`, **com UI de admin** (`ultra-admin` liga/desliga por empresa e usuário). |
| 28 | Error boundaries | ✅ EXISTE | `ErrorBoundary.tsx` (classe React, `componentDidCatch`) montado em App e Layout. |
| 29 | Observabilidade | ✅ EXISTE | Sentry front + edge (ligado staging/prod, com masking de PII BR), PostHog opcional, `/health` público agregando DB/Asaas/Resend. |
| 30 | Versionamento de release + changelog | ⚪ NÃO EXISTE | `package.json` travado em `1.0.0` estático, **sem CHANGELOG.md**, sem tabela de versão. Versão só existe como SHA de runtime no `/health`, invisível ao usuário. |
| 31 | Deploy / promoção previsível | 🟡 PARCIAL | Fluxo staging→main documentado (regra inquebrável no CLAUDE.md) + `promote-staging-to-main.yml`. Mas o `e2e-staging.yml` aponta para workflow deletado (Playwright nunca rodou). Fase 2 do plano de engenharia. |
| 32 | Paridade de env + inventário de secrets | 🟡 PARCIAL | `env.ts` já centraliza o front. Falta teste de paridade staging↔prod e inventário versionado de secrets de edge function. Fase 3. |
| 33 | Dependabot / Renovate | ⚪ NÃO EXISTE | Sem bot de update. O gate de `audit` fica vermelho por acumulação até alguém desligar. Fase 4. |

## E. Maturidade enterprise (conscientemente adiado)

| # | Prática | Estado | Nota |
|---|---------|--------|------|
| 34 | SSO/SAML, custom roles | ⏸️ PREMATURO | Linguagem de produto com muitos clientes e time. Custa caro, ninguém consome ainda. |
| 35 | Status page / roadmap público | ⏸️ PREMATURO | `docs/operations/monitoring/status-page-setup.md` existe como plano, não como produto. Certo assim. |
| 36 | API pública / webhooks / sandbox / A/B / health score | ⏸️ PREMATURO | Teatro de maturidade para o estágio. Vira dívida. |

---

## Placar

- ✅ **EXISTE: 15** — 2, 5, 8, 12, 13, 18, 19, 21, 23, 24, 26, 27, 28, 29 (+ base sólida em vários PARCIAL).
- 🟡 **PARCIAL: 10** — 1, 3, 4, 6, 7, 17, 25, 31, 32 (e 30 se contar o SHA de runtime).
- ⚪ **NÃO EXISTE / órfão: 8** — 9, 10, 11, 14, 15, 16, 20, 22, 30, 33.
- ⏸️ **PREMATURO: 3** — 34, 35, 36.

Isso é um sistema maduro para o estágio. A leitura crítica de julho ("a lista de
36 é majoritariamente prematura") continua correta: os itens que faltam ou são
baratos-e-já-quase-prontos, ou são conscientemente adiados.

---

## O que fazer — priorizado por sinal/esforço

### Agora (código já existe, é ligar ou consertar) — 🟢

1. **Montar o Command Palette (⌘K).** O código está pronto e morto no repo
   (`CommandPalette.tsx`, `useCommandPalette.ts`). Falta montar em `App.tsx`/`Layout`
   e ligar o atalho. De "não existe" para "existe" em horas. (#9, #10)
2. **Consertar o toast fantasma.** 6 arquivos usam `useToast` do shadcn sem o
   `<Toaster>` montado. Migrar esses 6 para Sonner (ou montar o toaster). É bug de
   feedback silencioso: o usuário faz uma ação e não vê confirmação. (#6)
3. **Padronizar microcopy Title Case → sentence case.** É a própria regra de marca
   do Matheus, hoje violada em "Novo Fornecedor", "Nova Disciplina", "Editar Meta"
   etc. Consistência, não feature. (#7)
4. **Corrigir a doc desatualizada.** `CLAUDE.md` (seção DB) ainda afirma que
   "nenhum job de CI valida types.ts" — o gate `types-sync` **existe e bloqueia
   merge** desde a Fase 1. Doc que mente sobre o próprio sistema custa confiança.

### Alto valor pro ICP (a tese do "número confiável") — 🟡

5. **Drill-down da margem do projeto.** O item nº1 do doc Level-up e ainda aberto.
   Clicar no lucro/margem e ver as receitas, custos e parcelas que o compõem.
   Precisa de uma RPC de detalhe (linhas, não só totais) + `onClick`/dialog na
   `Rentabilidade.tsx`. É o que separa "planilha bonita" de "sistema que o
   engenheiro assina embaixo". (#17)
6. **Freshness visual nas telas de dinheiro.** O dado já é atualizado em background;
   só falta expor "atualizado há X min" / "recalculando". Barato, amarra na
   confiança do número, reduz o "será que tá certo?". (#20)
7. **Undo universal + erros com próximo passo.** Estender o padrão de undo (que já
   existe em fornecedores) para leads e projetos, e trocar as mensagens genéricas
   ("Erro ao salvar X") e o `error.message` cru por texto que diz o próximo passo.
   Fecha #3 e #4 usando padrões que já existem no código.

### Higiene de release (barata, sobe percepção de profissionalismo) — 🟢/🟡

8. **CHANGELOG.md + versão viva.** Sair do `1.0.0` estático: adotar SemVer interno
   e um `CHANGELOG.md` (técnico) que já dá base para o "What's New" do usuário
   quando houver >1 cliente. Não é o módulo product_releases inteiro, é o arquivo. (#30)
9. **Dependabot/Renovate agrupado por semana.** Impede o gate de `audit` de ficar
   vermelho por acumulação. Meio dia, depois roda sozinho. (#33) — Fase 4 do plano.
10. **Fechar as Fases 2-3 do plano de engenharia** já escrito
    ([PLANO_ENGENHARIA_2026-07.md](../operations/PLANO_ENGENHARIA_2026-07.md)):
    consertar o `e2e-staging.yml`, piso de cobertura por módulo no financeiro,
    teste de paridade de env. (#25, #31, #32)

### Perto/depois do 1º pagante — não agora

Recentes/favoritos (#11), tour guiado (#14), What's New in-app (#15), central de
novidades (#16), permissão granular de margem (#22, só quando um escritório com
estagiário pedir), e todo o bloco enterprise (#34-36).

---

## Veredito de uma linha

O sistema já é profissional; o salto de nível agora são **quatro consertos de
horas** (⌘K morto, toast fantasma, microcopy, doc mentindo) e **três apostas no
número confiável** (drill-down, freshness, undo/erros), não um módulo novo. O
resto é para depois do primeiro cliente pagando.
