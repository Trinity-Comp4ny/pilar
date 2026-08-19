# SPEC: Consentimento de cookies (banner + gate no analytics)

**Data:** 2026-08-18
**Status:** Em implementação
**Autor:** Matheus Rezende + Claude
**Módulo:** transversal (produto + landing)

## Problema

O PostHog dispara `capture_pageview`, `capture_pageleave` e grava `distinctID` em
localStorage nos dois apps (produto em `app.pilarsoft.com.br` e landing em
`pilarsoft.com.br`) desde o boot, sem qualquer consentimento prévio do visitante.
O Guia Orientativo de Cookies da ANPD (2022) recomenda consentimento (opt-in) como
base legal padrão para cookies/rastreadores não-essenciais. Hoje o Pilar está fora
dessa recomendação.

## Objetivo

Nenhum cookie/tracker não-essencial é setado antes de o visitante aceitar
explicitamente, nos dois apps. A decisão é revogável a qualquer momento.

**Fora de escopo:** CMP de terceiros (Cookiebot/OneTrust), categorias de marketing/
publicidade (não existem hoje), consent management server-side, geo-detecção
GDPR vs LGPD. Publicação de rota pública `/termos` e `/cookies` fica fora desta
spec: ver decisão de negócio sobre CNPJ próprio em
`docs/legal/README.md`.

## Requisitos

1. Na primeira visita (sem decisão salva), um banner aparece em ambos os apps
   oferecendo "Aceitar todos" e "Recusar não essenciais", com peso visual igual
   entre os dois botões (nenhum escondido atrás de mais cliques).
2. A decisão é local ao navegador/origem (localStorage, chave
   `pilar_cookie_consent`), sem sincronizar com o backend. Os dois domínios são
   origens diferentes e não compartilham a decisão entre si, o que é aceitável
   (cada origem seta seus próprios cookies/local storage).
3. Enquanto não houver decisão, ou se a decisão for "recusar", `posthog.init()`
   nunca é chamado: nenhum dado sai para o PostHog, nenhuma chave é gravada em
   localStorage por ele.
4. Ao aceitar, o analytics inicializa imediatamente (sem precisar recarregar a
   página).
5. O visitante pode revogar/alterar a decisão depois:
   - No produto: botão "Alterar preferências de cookies" em `/privacidade`.
   - Na landing: link "Preferências de cookies" no rodapé.
   - Reabrir a decisão dispara o mesmo banner; aceitar depois de ter recusado
     inicializa o analytics; recusar depois de ter aceitado chama
     `posthog.opt_out_capturing()` + `posthog.reset()`.
6. Feature flags (`useFeatureFlag`) continuam funcionando sem consentimento de
   analytics: a fonte primária é a tabela `feature_flags` via RPC; o PostHog é
   só um fallback OR, então perder essa fonte quando o analytics está desligado
   é um degradê aceitável, não uma quebra.

## Critérios de aceite

- [ ] Dado um visitante novo (sem `pilar_cookie_consent` no localStorage), quando
      abre o app ou a landing, então o banner aparece e nenhuma chamada de rede
      pro PostHog acontece antes de uma escolha.
- [ ] Dado o banner visível, quando clica "Aceitar todos", então
      `posthog.init()` é chamado, o banner some, e a escolha persiste no reload.
- [ ] Dado o banner visível, quando clica "Recusar não essenciais", então
      `posthog.init()` nunca é chamado, o banner some, e a escolha persiste no
      reload.
- [ ] Dado consentimento já recusado, quando o usuário abre `/privacidade` e
      clica "Alterar preferências" → "Aceitar todos", então o analytics
      inicializa nessa mesma sessão sem reload.
- [ ] Dado consentimento já aceito, quando o usuário revoga pelo mesmo caminho,
      então `posthog.opt_out_capturing()` e `posthog.reset()` são chamados.
- [ ] Caso de borda: sem `VITE_POSTHOG_KEY` configurada (dev local), o banner
      ainda pode aparecer (é sobre a intenção do usuário, não sobre a chave
      existir), mas nada é enviado de qualquer forma (modo no-op já existente).

## Dados e contratos

Sem migration. Consentimento é 100% client-side:

```ts
// localStorage["pilar_cookie_consent"]
{ "analytics": boolean, "decidedAt": string /* ISO */ }
```

## Plano de implementação

1. `src/lib/cookieConsent.ts` e `apps/marketing/src/cookieConsent.ts`: leitura/
   escrita do localStorage + evento `pilar:cookie-consent-changed` para
   componentes reagirem sem prop drilling.
2. `src/lib/analytics.ts` e `apps/marketing/src/analytics.ts`: gate de consentimento
   dentro de `init/track/identify/isFeatureEnabled`; nova função
   `applyCookieConsent(accepted)`.
3. `CookieConsentBanner` nos dois apps: banner fixo inferior, dois botões de peso
   igual (`brand` e `outline`), link para a política de privacidade existente.
4. Montar o banner em `src/App.tsx` (dentro do `BrowserRouter`, junto do
   `PageTracker`, já que usa `<Link>`) e em `apps/marketing/src/App.tsx`.
5. Botão "Alterar preferências de cookies" em `src/pages/Privacidade.tsx`; link
   equivalente em `apps/marketing/src/components/LandingFooter.tsx`.
6. Ajustar `src/lib/analytics.test.ts` se o formato dos testes mudar.

## Decisões e riscos

- Decisão de arquitetura (banner próprio + localStorage vs. CMP de terceiro) via
  [ADR 0022](../architecture/adr/0022-consentimento-cookies-client-side.md).
- Risco aceito: os dois apps duplicam a lógica de consentimento (mesmo padrão já
  existente entre `src/lib/analytics.ts` e `apps/marketing/src/analytics.ts`,
  ver ADR 0021) em vez de um pacote compartilhado. Volume pequeno (~40 linhas),
  não vale a complexidade de um workspace novo por enquanto.
