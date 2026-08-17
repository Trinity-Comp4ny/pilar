# ADR 0018: Onboarding guiado com checklist derivado + tour driver.js

**Data:** 2026-08-12  
**Status:** Accepted

## Contexto

O usuário novo termina o onboarding "duro" de conta (`/profile-setup` → `/company-setup` → `/mfa/setup`) e cai no app sem guia do que fazer primeiro. O ICP é sócio de engenharia, não power-user de SaaS: sem orientação não descobre a ordem de setup e o produto parece vazio. Precisávamos de um guia dentro do app, cobrindo os 3 pilares (Gestão, Projetos, Obras), com um checklist persistente e balões por página.

Duas forças moldaram a decisão:

- **Onde mora o progresso.** Guardar booleano "criou pessoa?" por passo descasa da realidade (o dado pode ser apagado). Derivar de contagem de entidades é fonte única, sem drift.
- **Como desenhar os balões do tour.**
  - **Opção A — biblioteca driver.js**: ~5kb, zero-dep, spotlight + popover prontos, tematizável por CSS. Contra: 1 dependência nova.
  - **Opção B — custom com Radix Popover**: zero dep, 100% no design system. Contra: reimplementar máscara/spotlight, reposicionamento em scroll/resize, timing de montagem do alvo.

## Decisão

Dois mecanismos separados, uma fonte de verdade para progresso:

1. **Checklist flutuante** (`OnboardingChecklist`, montado no `Layout`): 3 seções por pilar, progresso **derivado de contagem** (`useOnboardingProgress` + `deriveProgress`). Registro canônico dos passos em `src/lib/onboarding/steps.ts`. Só para admin/owner; cada passo/seção gateado por feature (mesmo mecanismo do `FeatureRoute` via `usePermissions`), então a seção Obras só aparece para empresas com `feature: "obras"`.

2. **Tour por página** com **driver.js** (`src/lib/onboarding/tour.ts`, `OnboardingTourController`): ao chegar numa rota com passo pendente e tour não visto, destaca o elemento `[data-tour=...]` da ação primária. Tematizado em `src/styles/onboarding-tour.css` nos tokens da marca.

3. **Meta-estado por usuário** (dispensou / concluiu / tours vistos) em `profiles.onboarding_state jsonb`, escrito pela RPC `set_onboarding_state` (SECURITY DEFINER, merge raso, escopo `auth.uid()`). O progresso dos passos NÃO é gravado.

```sql
alter table public.profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;
-- set_onboarding_state(patch jsonb): profiles.onboarding_state || patch, para auth.uid()
```

## Consequências

**Positivas:**

- Progresso sempre honesto (reflete dados reais), sem tabela de flags para manter em sincronia.
- Um só ponto de verdade dos passos (`steps.ts`); adicionar passo/pilar é declarativo.
- driver.js resolve spotlight/posicionamento; o tour nasce pequeno e no tema.
- Gating reusa `usePermissions`; nada guia o usuário para tela sem acesso.

**Negativas:**

- Dependência nova (driver.js) e CSS de tema para manter.
- Cada troca de rota faz contagens leves (mitigado por `staleTime` de 2 min no react-query).
- `set_onboarding_state` entra no `types.ts` só no `gen:types` do deploy; até lá há um cast localizado em `src/lib/onboarding/state.ts`.
- v1 é experiência de admin: colaborador não vê o checklist de setup.

## Decisões relacionadas

- SPEC 034 (`docs/specs/034-onboarding-guiado.md`)
- Migration `supabase/migrations/20260823000000_onboarding_state.sql`
- ADR 0016 (rotas aninhadas por módulo): as rotas-alvo do tour seguem `/gestao/*`, `/projetos`, `/obras/*`.
