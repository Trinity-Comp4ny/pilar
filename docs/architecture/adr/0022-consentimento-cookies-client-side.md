# ADR 0022: Consentimento de cookies client-side com gate no analytics, sem CMP de terceiro

**Data:** 2026-08-18
**Status:** Accepted, com a decisão de armazenamento revisada pelo
[ADR 0032](./0032-consentimento-de-cookies-por-conta-e-por-dominio.md): o gate
fail-closed e o banner da landing continuam valendo, mas a decisão não vive mais
em `localStorage` por origem, e sim em cookie de `.pilarsoft.com.br` mais a
tabela `cookie_consents` para usuário autenticado.

## Contexto

O PostHog roda nos dois apps (`src/lib/analytics.ts` no produto,
`apps/marketing/src/analytics.ts` na landing) desde o boot, sem consentimento
prévio. O Guia Orientativo de Cookies da ANPD (2022) recomenda opt-in como base
legal padrão para cookies não-essenciais. Precisamos de um mecanismo de
consentimento antes de qualquer chamada a `posthog.init()`. Ver
[SPEC 048](../../specs/048-consentimento-cookies.md).

O inventário real de cookies/trackers do Pilar hoje é pequeno: sessão do
Supabase (essencial, não pode ser desligado) + PostHog (a única categoria
não-essencial). Isso muda o cálculo de custo/benefício de uma solução:

- **Opção A, CMP de terceiro** (Cookiebot, OneTrust, Osano): cobre casos
  complexos (geo-detecção GDPR/LGPD/CCPA, IAB TCF, múltiplas categorias de
  marketing). Custo: mais um vendor pago, mais um script de terceiro na landing
  (o que a Fase 0/ADR 0021 removeu para baixar o bundle), overkill para uma
  única categoria opcional.
- **Opção B, banner próprio + localStorage**, gate no `initAnalytics()`: zero
  dependência nova, controle total sobre quando o PostHog é chamado, consistente
  com o padrão já usado (dois `analytics.ts` independentes por app, ADR 0021).
  Escala mal se surgirem 5+ categorias de terceiros, mas isso está fora do
  horizonte atual do produto.

## Decisão

Usar a **Opção B**: banner de consentimento próprio, decisão gravada em
`localStorage["pilar_cookie_consent"]` (`{ analytics: boolean, decidedAt: string }`),
por origem (produto e landing não compartilham a decisão, cada um seta seus
próprios cookies).

`analytics.init()`, `track()`, `identify()` e `isFeatureEnabled()` checam o
consentimento antes de tocar no PostHog. Sem decisão registrada, o padrão é
**não rastrear** (fail-closed, não fail-open): omissão de decisão nunca vira
tracking silencioso. `applyCookieConsent(accepted)` é o único ponto de entrada
que liga (`init()`) ou desliga (`posthog.opt_out_capturing()` + `posthog.reset()`)
o PostHog em runtime, chamado tanto pelo banner quanto pelo botão de revogação
em `/privacidade` (produto) e no rodapé (landing).

Categoria única exposta ao usuário: **Analytics** (o resto, sessão Supabase,
é essencial e não aparece como toggle, porque desligá-lo quebra o login). Se
surgir uma segunda categoria de terceiro (ex: pixel de ads), o mesmo objeto de
consentimento ganha uma chave nova; não redesenhar antes disso ser real.

## Consequências

**Positivas:**

- Nenhuma chamada de rede ou escrita de storage do PostHog acontece antes do
  aceite explícito: fecha o gap de conformidade com o guia da ANPD.
- Sem vendor novo, sem script de terceiro, sem custo recorrente.
- Reaproveita a separação de apps do ADR 0021 em vez de forçar um pacote
  compartilhado para ~40 linhas de lógica.

**Negativas:**

- Lógica de consentimento duplicada entre os dois apps (mesmo trade-off já
  aceito para `analytics.ts` no ADR 0021).
- Se o Pilar precisar de múltiplas categorias de terceiros no futuro (ads,
  heatmap, chat widget), a Opção A volta a ser mais barata que manter um CMP
  caseiro. Reavaliar nesse momento, não antecipar agora.
- Não cobre geo-detecção (mesmo banner para visitante brasileiro ou
  estrangeiro); aceitável porque o Pilar é B2B nacional (ICP: engenharia
  multidisciplinar brasileira).

## Decisões relacionadas

- [ADR 0021](./0021-marketing-site-separado-do-app.md): app e landing são
  builds/deploys separados, cada um com seu próprio `analytics.ts`. Este ADR
  segue o mesmo padrão de duplicação controlada.
- [SPEC 048](../../specs/048-consentimento-cookies.md): requisitos e critérios
  de aceite da feature.
