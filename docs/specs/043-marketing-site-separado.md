# SPEC: Site de marketing separado do app (Fase 1 da auditoria de performance)

**Data:** 2026-08-17
**Status:** Draft
**Autor:** Claude (a partir de auditoria externa trazida pelo Matheus)
**Módulo:** landing / infra de deploy

## Problema

A landing pública (`/`) carrega o app inteiro por trás: `App.tsx` embrulha a rota
com `QueryClientProvider`, `AuthProvider`, `ImpersonationProvider`,
`SettingsModalProvider`, Sentry e PostHog, além de montar `MockupTablet.tsx`
(1380 linhas, 4 componentes shadcn) mesmo escondido no mobile. Resultado medido
pela auditoria externa (2026-08-17): Lighthouse mobile 58 (meta ≥90), LCP mobile
9,0s (meta ≤2,5s), 647 KiB de JS próprio + 500 KiB sem uso na página. Ver
[[project_auditoria_landing_posicionamento_performance_2026-08-17]] na memória do
projeto e a Fase 0 já entregue no PR #240.

Os domínios `pilarsoft.com.br` e `app.pilarsoft.com.br` já existem (DNS pronto);
falta separar o build/deploy.

## Objetivo

A landing pública deixa de carregar qualquer dependência do app autenticado
(Supabase, React Query, Sentry, PostHog, componentes `@/components/ui`). Ela passa
a ser um app Vite+React+Tailwind próprio (`apps/marketing`), com deploy Vercel
isolado, atado a `pilarsoft.com.br`.

**Fora de escopo desta spec:**

- Migrar para framework SSR/SSG completo (Next.js, Astro) — decisão já tomada de
  não migrar de stack (ver nota do estudo de arquitetura, ADR relacionado).
- Pré-renderização estática (HTML sem depender de JS) — vira uma Fase 1b
  separada, depois que o bundle CSR já estiver pequeno e o deploy validado.
- Cutover de DNS/Vercel (apontar `pilarsoft.com.br` pro novo projeto) — ação
  manual do Matheus no dashboard, listada nos "Decisões e riscos".
- Capturas reais de produto pra substituir o `MockupTablet` — sem os assets nesta
  rodada, o Hero fica sem visual de produto até Matheus fornecer as capturas.
- Reescrever posicionamento/copy (isso é a Fase 1 de conteúdo do relatório
  externo, decisão de produto, não desta spec técnica).

## Requisitos

1. `apps/marketing` builda com `npm run build --workspace=apps/marketing` e
   produz um bundle inicial sem `@supabase/supabase-js`, `@tanstack/react-query`,
   `@sentry/*`, `posthog-js` nem `react-router-dom`.
2. Todo link que hoje aponta para `/login`, `/cadastro` ou `/planos` dentro dos
   componentes de landing usa `<a href="https://app.pilarsoft.com.br/...">`
   absoluto, não `<Link>` de router (os dois apps não compartilham roteador).
3. `apps/marketing` reaproveita os componentes reais da landing já corrigidos na
   Fase 0 (`LandingHeader`, `HeroSection`, `ProofSection`, `FeaturesSection`,
   `HowItWorksSection`, `CTASection`, `LandingFooter`) — não recria copy do zero.
4. Cores, espaçamento e tipografia vêm do `tailwind.config.ts` raiz (importado,
   não duplicado) e de `src/styles/tokens.css` (importado via caminho relativo).
   CSS específico de landing sai de `src/index.css` para `src/styles/landing.css`,
   compartilhado pelos dois apps.
5. O app raiz mantém a rota `/` → `Landing` funcionando exatamente como está
   (Fase 0) até o cutover de domínio — este PR não remove a rota antiga.
6. `PricingSection.tsx`, `FAQSection.tsx`, `BrazilSection.tsx` e
   `TargetAudienceSection.tsx` em `src/pages/landing/components/` são removidos
   do repositório: confirmado que não são importados por nenhuma rota (código
   morto de uma versão anterior da landing).

Requisitos não-funcionais:

- **Performance:** bundle JS inicial do `apps/marketing` deve ficar sensivelmente
  abaixo do que a Fase 0 mediria hoje (647 KiB) — meta informal ≤200 KiB
  comprimido nesta primeira rodada (a meta ≤120 KiB do relatório é pra depois da
  pré-renderização, Fase 1b).
- **Sem regressão:** `npm run typecheck`, `npm run lint` e `npm run test:run` do
  workspace raiz continuam passando depois da remoção dos componentes mortos.

## Critérios de aceite

- [ ] Dado `npm run build --workspace=apps/marketing`, quando inspeciono o
      output, então não há chunk de `supabase-js`, `react-query`, `sentry` ou
      `posthog` no bundle inicial.
- [ ] Dado o app de marketing rodando localmente (`npm run dev --workspace=apps/marketing`
      ou `vite preview`), quando clico em "Testar grátis" ou "Começar Grátis",
      então navego para `https://app.pilarsoft.com.br/cadastro` (link absoluto,
      confirmável no HTML renderizado mesmo sem poder completar a navegação
      cross-domain localmente).
- [ ] Dado o app raiz depois da remoção dos 4 componentes mortos, quando rodo
      `npm run typecheck && npm run lint && npm run test:run`, então tudo passa.
- [ ] Dado a rota `/` do app raiz (ainda ativa), quando acesso localmente, então
      continua renderizando a landing como antes da Fase 1 (nenhuma regressão
      visual ou funcional introduzida por esta spec).
- [ ] Caso de borda: `apps/marketing/tailwind.config.ts` muda de cor num token em
      `src/styles/tokens.css` → o build do marketing reflete a mudança sem editar
      dois arquivos (prova que não duplicou o token).

## Dados e contratos

Nenhuma migration, RPC ou edge function envolvida. Contrato novo: o `href`
absoluto `https://app.pilarsoft.com.br` fica hardcoded nos componentes de
landing portados — não há env var de domínio hoje no front (`env.ts` não tem
`VITE_APP_URL`); se o domínio mudar, é busca-e-troca em `apps/marketing/src`.
Considerar adicionar `VITE_APP_URL` como env var se este hardcode incomodar depois.

## Plano de implementação

1. Criar `src/styles/landing.css` extraindo de `src/index.css` as classes
   `.reveal-up`, `.text-balance`, `.landing-grain`, `.hero-dot-grid`,
   `.hero-italic-highlight`, `.landing-highlight` e o bloco de
   `prefers-reduced-motion` correspondente. `src/index.css` passa a importar esse
   arquivo em vez de conter o CSS inline (refactor puro, sem mudança de
   comportamento no app raiz).
2. Confirmar que `PricingSection.tsx`, `FAQSection.tsx`, `BrazilSection.tsx` e
   `TargetAudienceSection.tsx` não são importados em nenhum lugar (grep completo,
   incluindo lazy imports por string) e deletá-los.
3. Criar `apps/marketing/` como novo workspace: `package.json` (deps: react,
   react-dom, lucide-react; devDeps mínimas, o resto hospeda via hoist do
   workspace raiz), `vite.config.ts`, `tailwind.config.ts` (importa o raiz),
   `postcss.config.js`, `index.html`, `tsconfig.json` (estende o raiz),
   `src/main.tsx`, `src/App.tsx`, `src/index.css`.
4. Mover (não copiar) `LandingHeader.tsx`, `HeroSection.tsx`, `ProofSection.tsx`,
   `FeaturesSection.tsx`, `HowItWorksSection.tsx`, `CTASection.tsx`,
   `LandingFooter.tsx` de `src/pages/landing/components/` para
   `apps/marketing/src/components/`. Trocar `Link`/`react-router-dom` por `<a>`
   absoluto pros três destinos que apontam pro app. Remover o `useLocation`/
   `useNavigate`/scroll-to-section-via-router de `LandingHeader.tsx` (sem router,
   vira scroll direto por `id`, já que estamos sempre em `/`).
5. Adicionar `"workspaces": ["apps/marketing"]` no `package.json` raiz. Ajustar
   `.gitignore`/`tsconfig` se necessário para não quebrar o typecheck do
   workspace raiz nem o do marketing.
6. `npm install` na raiz (hoist), `npm run build --workspace=apps/marketing`,
   inspecionar tamanho do bundle. Rodar `npm run dev --workspace=apps/marketing`
   e conferir visualmente (via `run` ou browser) que a página renderiza igual à
   landing atual, menos o mockup.
7. Rodar a suíte inteira do workspace raiz (`typecheck`, `lint`, `test:run`) pra
   garantir que a remoção do código morto e a extração do CSS não regrediram
   nada em `src/pages/Landing.tsx` (que continua ativo).
8. Documentar no PR os passos manuais pendentes pro Matheus: criar o segundo
   projeto Vercel com root directory `apps/marketing`, apontar `pilarsoft.com.br`
   pra ele, só então remover a rota `/` do app raiz (PR futuro).

## Decisões e riscos

- Decisão de arquitetura registrada em [ADR 0021](../architecture/adr/0021-marketing-site-separado-do-app.md).
- **Risco:** sem acesso ao Vercel do projeto (a conta de CLI disponível é de outra
  organização), não é possível validar o deploy real nem rodar Lighthouse contra
  `pilarsoft.com.br` de fato servindo o novo build. A verificação fica limitada a
  build local + inspeção de bundle até o Matheus fazer o cutover manual.
- **Risco:** hardcode de `https://app.pilarsoft.com.br` nos componentes — se o
  domínio mudar, precisa buscar-e-trocar (aceito por ora, ver seção de dados).
- **Suposição que pode furar:** que sessão de auth não precisa aparecer na
  landing (usuário logado que visita `pilarsoft.com.br` não é redirecionado
  automaticamente pro app — ele clica em "Entrar"). Cookies de sessão do
  `app.pilarsoft.com.br` não são visíveis em `pilarsoft.com.br` de qualquer
  forma, então essa suposição é forçada pela própria separação de domínio, não
  uma escolha de UX.
