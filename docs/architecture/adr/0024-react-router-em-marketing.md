# ADR 0024: Adotar react-router-dom em apps/marketing para rotas internas

**Data:** 2026-08-18
**Status:** Accepted

## Contexto

`apps/marketing` (site de marketing separado do app autenticado, ver [ADR 0021](./0021-marketing-site-separado-do-app.md)) hoje é uma página única: `App.tsx` renderiza todas as sections direto, navegação interna é só scroll até âncora (`#modulos`, `#faq` etc.). O site vai crescer pra multi-página de verdade (`/produto`, `/solucoes` na próxima rodada, ver [SPEC 047](../../specs/047-redesign-landing-page.md)), o que exige rotas client-side reais, não só âncoras.

Opções consideradas:

- **Opção A, Continuar single-page com âncoras.** Não atende ao requisito: "Produto" e "Soluções" vão precisar de conteúdo profundo demais para caber como section da home sem inflar a página inicial de novo (o problema original que motivou a SPEC 047).
- **Opção B, `react-router-dom` em modo `BrowserRouter`.** Mesma lib já usada no app principal (`package.json` raiz, `^6.26.2`), sem decisão nova de API a aprender, comportamento consistente entre os dois workspaces. Custo de bundle baixo (~10kb gzip) frente ao ganho de estrutura.
- **Opção C, Framework de rotas por arquivo (file-based routing, ex. algo tipo Next.js App Router).** Overkill para 3-4 páginas estáticas; traria SSR/build pipeline novo que a ADR 0021 explicitamente evitou (o objetivo era Lighthouse alto com Vite simples, não reintroduzir complexidade de framework).

## Decisão

Adotar **`react-router-dom@^6.26.2`** (mesma versão do root `package.json`) em `apps/marketing`, em modo `BrowserRouter`.

```tsx
// apps/marketing/src/main.tsx
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// apps/marketing/src/App.tsx, vira o layout de rotas
<Routes>
  <Route path="/" element={<Home />} />
  {/* /produto, /solucoes entram na próxima rodada */}
</Routes>;
```

Isso **não reabre a fronteira do ADR 0021**: `apps/marketing` continua sem importar Supabase, React Query, Sentry ou componentes de `@/components/ui` do app autenticado. O roteador aqui é só navegação de página estática client-side, nenhum data-fetching novo, nenhum provider novo além do `BrowserRouter`. Links entre `apps/marketing` e o app autenticado (`/login`, `/cadastro`, `/planos`) continuam como `<a>` absolutos, não `<Link>`, os dois apps seguem sem roteador compartilhado.

Consequência técnica a validar: o autocapture de pageview do `posthog-js` (`apps/marketing/src/analytics.ts`) foi calibrado pra uma SPA de página única; com rotas internas, confirmar que ele captura navegação client-side (`pushState`/`popstate`) ou disparar `posthog.capture("$pageview")` manualmente no listener de rota.

Como o site vira multi-página em produção (Vercel), esta mudança exige também `apps/marketing/vercel.json` com rewrite SPA-fallback (`/(.*) → /index.html`), que hoje não existe, sem ele, acessar uma rota nova direto por URL ou dar F5 retorna 404. Ver detalhes no PR desta rodada.

## Consequências

**Positivas:**

- Rotas internas reais (`/produto`, `/solucoes`) ficam viáveis sem inflar a home de novo.
- Mesma lib do app principal, zero curva de aprendizado nova, comportamento previsível.

**Negativas:**

- +1 dependência em `apps/marketing` (baixo custo de bundle).
- Precisa de `vercel.json` próprio com rewrite, que não existia até aqui, item de infraestrutura que soma ao escopo desta rodada.

## Decisões relacionadas

- [ADR 0021](./0021-marketing-site-separado-do-app.md): site de marketing separado; esta ADR não reabre essa fronteira, só adiciona roteamento interno.
- [ADR 0023](./0023-framer-motion-no-site-de-marketing.md): Framer Motion, mesma rodada de implementação.
- [SPEC 047](../../specs/047-redesign-landing-page.md): consome esta decisão para a fundação de páginas futuras (Produto/Soluções).
