# ADR 0021: Separar o site de marketing do app autenticado em apps/marketing

**Data:** 2026-08-17
**Status:** Proposed

## Contexto

Auditoria externa de posicionamento e performance (2026-08-17, ver
[SPEC 043](../../specs/043-marketing-site-separado.md)) mediu Lighthouse mobile 58
(meta ≥90) e LCP mobile 9,0s (meta ≤2,5s) na landing pública. Causa raiz confirmada
no código: a rota `/` (Landing) vive na mesma árvore de `Routes` de `App.tsx` que o
app autenticado, embrulhada pelos mesmos providers (`QueryClientProvider`,
`AuthProvider`, `ImpersonationProvider`, `SettingsModalProvider`, Sentry, PostHog).
O relatório mediu 647 KiB de JS próprio e 500 KiB sem uso nessa página.

Os domínios `pilarsoft.com.br` (landing) e `app.pilarsoft.com.br` (app) já existem
e apontam hoje pro mesmo build Vercel — a separação que falta é de código/deploy,
não de DNS.

- **Opção A — migrar para framework SSR (Next.js etc.)**: resolveria de raiz, mas
  contradiz o veredito do estudo de arquitetura de não migrar
  ([nota de projeto](../../operations/PLANO_ENGENHARIA_2026-07.md)); custo alto pra
  um problema que é só a landing.
- **Opção B — rota pública isolada no mesmo build Vite**: menor esforço imediato,
  mas o deploy continua sendo um só. Qualquer mudança no app dispara redeploy da
  landing e vice-versa; CSP, cache headers e orçamento de JS continuam acoplados.
- **Opção C — `apps/marketing` como app Vite+React+Tailwind independente, no mesmo
  repositório, deploy Vercel próprio, atado a `pilarsoft.com.br`**: reaproveita os
  componentes de landing já corrigidos (Fase 0, PR #240), mas com bundle e ciclo de
  deploy isolados do app.

## Decisão

Usar a **Opção C**. `apps/marketing` é adicionado como workspace npm
(`"workspaces": ["apps/marketing"]` no `package.json` raiz), hospeda os componentes
reais da landing (`LandingHeader`, `HeroSection`, `ProofSection`, `FeaturesSection`,
`HowItWorksSection`, `CTASection`, `LandingFooter`) e não importa Supabase, React
Query, Sentry, PostHog ou qualquer componente de `@/components/ui`. Links para
`/login`, `/cadastro` e `/planos` são `<a>` absolutos para
`https://app.pilarsoft.com.br/...`, não `<Link>` do React Router — os dois apps não
compartilham roteador.

Tokens de design (`src/styles/tokens.css`) e o `tailwind.config.ts` raiz continuam
sendo a única fonte de verdade: `apps/marketing/tailwind.config.ts` importa o config
raiz e só sobrescreve `content`. CSS específico de landing (`.landing-grain`,
`.hero-dot-grid`, `.hero-italic-highlight`, `.landing-highlight`, `.reveal-up`) sai
de `src/index.css` para `src/styles/landing.css`, importado pelos dois apps.

O app raiz mantém a rota `/` → `Landing` como estava (já corrigida na Fase 0) até
`pilarsoft.com.br` ser de fato apontado pro novo deploy no Vercel — remover essa
rota antes seria quebrar o domínio de produção sem rede de segurança.

```
apps/marketing/
  package.json        # workspace próprio, deps mínimas (react, react-dom, lucide-react, vite, tailwind)
  vite.config.ts
  tailwind.config.ts   # extends ../../tailwind.config.ts, sobrescreve content
  index.html
  src/
    main.tsx           # sem Supabase/React Query/Sentry/PostHog
    App.tsx            # monta as seções da landing, sem React Router
```

## Consequências

**Positivas:**

- Bundle inicial da landing deixa de carregar Supabase/React Query/Sentry/PostHog e
  o `MockupTablet.tsx` (1380 linhas, 4 componentes shadcn); só isso já deve tirar a
  maior parte dos 647 KiB medidos.
- Deploy da landing e do app ficam desacoplados: mudar copy/seção não dispara
  redeploy do produto, e vice-versa.
- `PricingSection.tsx`, `FAQSection.tsx`, `BrazilSection.tsx` e
  `TargetAudienceSection.tsx` (achados como código morto, não importados por
  nenhuma rota) saem do repositório em vez de serem migrados.

**Negativas:**

- Dois lockfiles de fato compartilhando `node_modules` via workspace: mudança de
  dependência de UI (ex. versão do `lucide-react`) precisa ser replicada nos dois
  `package.json` se um dia divergir.
- Navegação entre os dois apps deixa de ser SPA (recarrega página completa ao ir de
  `pilarsoft.com.br` pra `app.pilarsoft.com.br`) — aceitável, é o preço de dois
  deploys.
- Sem captura real de produto disponível nesta rodada, o Hero da landing fica sem
  o visual do mockup até haver screenshots reais (item já previsto no relatório
  externo, Fase 1).
- Cutover de DNS/Vercel (apontar `pilarsoft.com.br` pro novo projeto) é manual,
  fora do alcance deste PR — ver seção de decisões da SPEC 043.

## Decisões relacionadas

- [SPEC 043](../../specs/043-marketing-site-separado.md)
- ADR 0008: design tokens (`apps/marketing` reaproveita, não duplica)
- PR #240: Fase 0 do mesmo relatório externo (copy/a11y da landing)
- Nota de projeto do estudo de arquitetura 2026-08-17: veredito de não migrar de framework
