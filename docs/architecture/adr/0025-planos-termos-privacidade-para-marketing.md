# ADR 0025: Mover Planos, Termos e Privacidade (texto legal) para apps/marketing

**Data:** 2026-08-18
**Status:** Proposed

## Contexto

O [ADR 0021](./0021-marketing-site-separado-do-app.md) separou a landing (`/`) do
app autenticado em `apps/marketing`, mas deixou de fora três rotas que também são
conteúdo público: `/planos`, `/termos` e `/privacidade`. Elas continuam vivendo em
`src/App.tsx` (app raiz), reaproveitando uma cópia paralela de `LandingHeader`/
`LandingFooter` em `src/pages/landing/components/` que já diverge da versão real
usada pela landing em `apps/marketing`.

Efeito prático: clicar em "Ver planos" na LP sai de `pilarsoft.com.br` pra
`app.pilarsoft.com.br` com reload de página inteiro, carregando `QueryClientProvider`,
`AuthProvider`, `ImpersonationProvider` e `SettingsModalProvider` só pra mostrar uma
grade de preço. Login e Cadastro têm o mesmo padrão de link `<a>` absoluto, mas
fazem sentido no app (MFA, Turnstile, sessão). Planos/Termos/Privacidade não têm
esse motivo.

`Privacidade` é um caso à parte: além do texto legal, a página tem ações reais de
autoatendimento LGPD (exportar e excluir dados, `src/pages/Privacidade.tsx:73-126`)
que chamam `useAuth()` e as RPCs `request_data_export`/`request_data_deletion`,
exigindo sessão autenticada. Não pode simplesmente mudar de domínio.

`apps/marketing` hoje não tem nenhuma dependência de backend (sem
`@supabase/supabase-js`, sem `@tanstack/react-query`) e o `connect-src` do CSP em
`apps/marketing/vercel.json` exclui explicitamente `*.supabase.co` — decisão
deliberada da separação original (bundle 100% estático). A tabela
`pilar_subscription_plans` já tem `GRANT SELECT` para `anon`
(`supabase/migrations/20260507100000_restore_pilar_plans_grants.sql`), então dá pra
ler os planos direto via REST do PostgREST (`fetch` + header `apikey`), sem precisar
do client `supabase-js`.

- **Opção A — mover as 3 páginas inteiras, incluindo as ações de Privacidade**:
  quebra `request_data_export`/`request_data_deletion`, que dependem de sessão
  Supabase que o marketing não tem.
- **Opção B — manter as 3 no app raiz, só ajustar os links de navegação**: não
  resolve o problema real (o domínio errado é a causa do reload/peso), só
  cosmético.
- **Opção C (escolhida) — mover Planos e Termos inteiros; separar Privacidade em
  texto (marketing) + ações autenticadas (painel novo no `SettingsDialog` do
  app)**: Planos no marketing busca dado via `fetch` direto ao REST do Supabase
  (apikey anon), sem cliente completo.

## Decisão

1. `apps/marketing/src/pages/Planos.tsx` (rota `/planos`) busca
   `pilar_subscription_plans` com `fetch` puro contra
   `${VITE_SUPABASE_URL}/rest/v1/pilar_subscription_plans?select=...&ativo=eq.true&order=ordem.asc`,
   header `apikey: VITE_SUPABASE_PUBLISHABLE_KEY`. Sem `@supabase/supabase-js`,
   sem `@tanstack/react-query` (um `useEffect`+`useState` simples resolve, o
   workspace não tem react-query hoje e não é este ADR que introduz).
2. `apps/marketing` ganha as env vars `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY` (mesmos valores do app raiz, mesmo projeto
   Supabase, chave já pública por natureza).
3. `apps/marketing/vercel.json`: `connect-src` ganha `https://*.supabase.co`.
4. `apps/marketing/src/pages/Termos.tsx` (rota `/termos`): conteúdo estático
   migrado 1:1 de `src/pages/Termos.tsx`.
5. `apps/marketing/src/pages/Privacidade.tsx` (rota `/privacidade`): só o texto
   legal (seções 1 a 6, tabela de retenção, DPO) de `src/pages/Privacidade.tsx`.
   Troca os dois blocos de ação (exportar/excluir) por um parágrafo linkando pra
   `app.pilarsoft.com.br/login` explicando que o exercício desses direitos pelo
   sistema exige estar autenticado, em Configurações → Privacidade.
6. Novo `src/components/settings/panels/PrivacidadePanel.tsx` no app raiz, com o
   conteúdo de exportar/excluir dados que hoje está em `src/pages/Privacidade.tsx`
   (mesmo `useAuth()`, mesmas RPCs, sem mudança de contrato), registrado no rail
   do `SettingsDialog`. Linka pra política completa em
   `https://pilarsoft.com.br/privacidade`.
7. `src/App.tsx`: as rotas `/planos`, `/termos` e `/privacidade` viram redirects
   externos (mesmo padrão de `LandingRedirect`, `src/App.tsx:124-129`) para
   `https://pilarsoft.com.br/...`.
8. `src/pages/landing/components/LandingHeader.tsx` e `LandingFooter.tsx` (cópia
   paralela, hoje usada só por `src/pages/planos/index.tsx`) são deletados como
   parte da mesma mudança — viram código morto assim que a página some.
9. `src/pages/planos/` continua existindo, mas só como infraestrutura de billing:
   `hooks/usePlans.ts`, o tipo `Plan`, `components/CycleToggle.tsx` e
   `components/PlanCard.tsx`, consumidos por `Checkout`
   (`src/pages/checkout/index.tsx`) e `ChangePlanDialog`
   (`src/pages/billing/components/ChangePlanDialog.tsx`). O `index.tsx` (a página
   pública em si) é deletado.

```
apps/marketing/src/pages/
  Planos.tsx        # fetch REST direto, sem supabase-js
  Termos.tsx        # estático
  Privacidade.tsx   # estático + link pro login pras ações autenticadas

src/components/settings/panels/
  PrivacidadePanel.tsx   # exportar/excluir dados, migrado de src/pages/Privacidade.tsx
```

## Consequências

**Positivas:**

- Navegar de qualquer seção da LP pra Planos/Termos/Privacidade fica consistente
  com Gestão/Projetos/Obra/FAQ: mesma SPA, mesmo header, sem reload pesado.
- Fecha o último resquício de dívida do ADR 0021: a cópia paralela de
  header/footer no app raiz vira código morto e sai do repositório.
- Ações de LGPD ficam num lugar mais descobrível e coerente (Configurações), em
  vez de uma URL solta que só funcionava por acidente quando o usuário estava
  logado.

**Negativas:**

- `apps/marketing` deixa de ser 100% estático: ganha uma chamada de rede (REST
  puro, sem client) e duas env vars novas. O CSP precisa abrir `*.supabase.co`
  no `connect-src`, ampliando uma superfície hoje deliberadamente fechada — a
  chave usada é a `anon`/`publishable`, já pública por design (mesma exposta no
  app raiz), então o risco incremental é baixo, mas existe.
- `TERMS_VERSION`/`PRIVACY_VERSION` em `src/lib/legalVersions.ts` continuam sendo
  bump manual: quem editar o texto em `apps/marketing` precisa lembrar de
  atualizar essas constantes no app raiz. Nenhuma trava automática garante isso.
- Usuário deslogado que caiu em `/privacidade` (agora no marketing) querendo
  excluir dados sem mais acesso à conta só tem a opção de email — igual já era
  hoje, sem piora, mas também sem melhora.

## Decisões relacionadas

- [ADR 0021](./0021-marketing-site-separado-do-app.md): separação original da LP.
- [ADR 0008](./0008-design-system-fonte-unica.md): tokens que `apps/marketing`
  já reaproveita (nenhuma mudança aqui).
- [SPEC 043](../../specs/043-marketing-site-separado.md): Fase 1 da separação.
- [SPEC 049](../../specs/049-aceite-termos-de-uso-onboarding.md): consumidor de
  `TERMS_VERSION`/`PRIVACY_VERSION`, não muda de contrato aqui.
- [SPEC 050](../../specs/050-planos-termos-privacidade-no-marketing.md): esta
  migração.
