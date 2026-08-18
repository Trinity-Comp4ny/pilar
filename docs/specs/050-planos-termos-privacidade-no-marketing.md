# SPEC: Planos, Termos e Privacidade no site de marketing

**Data:** 2026-08-18
**Status:** Em implementação (pendente configurar env vars no Vercel do marketing e o deploy)
**Autor:** Claude (a pedido do Matheus, seguindo achado de UX na navegação da LP)
**Módulo:** landing / infra de deploy

## Problema

Na landing pública (`apps/marketing`), navegar de Gestão/Projetos/Obra/FAQ pra
"Planos" (ou Termos, Privacidade) parece uma página quebrando: sai do domínio
`pilarsoft.com.br` e recarrega inteiro em `app.pilarsoft.com.br`, porque essas
três rotas continuam vivas em `src/App.tsx` (app raiz), com todo o peso de
`QueryClientProvider`/`AuthProvider`/`ImpersonationProvider`/`SettingsModalProvider`
por trás. É a dívida que sobrou do [ADR 0021](../architecture/adr/0021-marketing-site-separado-do-app.md),
que separou só a home (`/`).

Login e Cadastro têm o mesmo formato de link, mas pertencem de fato ao app
(MFA, Turnstile, sessão). Planos e Termos não têm dependência de sessão.
Privacidade é o caso intermediário: tem texto legal (sem dependência) e duas
ações reais de autoatendimento LGPD (exportar/excluir dados) que exigem login.

## Objetivo

`/planos` e `/termos` passam a viver inteiramente em `apps/marketing`, com a
mesma navegação SPA das outras páginas da LP. `/privacidade` divide em duas
metades: o texto legal completo vai pro marketing (público, sem login); as
ações de exportar/excluir dados saem da URL solta e viram um painel dentro do
`SettingsDialog` do app (só acessível logado, mais descobrível).

**Fora de escopo:**

- Trocar o texto/conteúdo legal em si (Termos, Privacidade) — é migração de
  local, não revisão jurídica.
- Adicionar `@supabase/supabase-js` ou `@tanstack/react-query` a
  `apps/marketing` — a busca de planos usa `fetch` direto contra o REST do
  Supabase (ver [ADR 0025](../architecture/adr/0025-planos-termos-privacidade-para-marketing.md)).
- Automatizar o bump de `TERMS_VERSION`/`PRIVACY_VERSION` em
  `src/lib/legalVersions.ts` — continua manual, ver spec 049.
- Resolver o link quebrado `/admin?tab=privacidade` referenciado em
  `supabase/functions/send-data-deletion-notification/index.ts:264` (achado
  incidental durante a investigação, tab não existe hoje; registrar como
  débito separado, não misturar nesta spec).

## Requisitos

1. `apps/marketing` ganha as rotas `/planos` e `/termos` (React Router já usado
   lá, ver `apps/marketing/src/App.tsx`), com o mesmo `LandingHeader`/
   `LandingFooter` das outras páginas — sem reload ao navegar a partir da home
   ou do FAQ.
2. A página `/planos` do marketing busca `pilar_subscription_plans` via `fetch`
   puro contra `${VITE_SUPABASE_URL}/rest/v1/pilar_subscription_plans`
   (`select=id,slug,nome,descricao,preco_mensal,preco_anual,max_usuarios,max_projetos,features,destaque,ordem&ativo=eq.true&order=ordem.asc`),
   header `apikey: VITE_SUPABASE_PUBLISHABLE_KEY`, e reproduz a grade de planos
   - `EnterpriseCard` + `CycleToggle` (mensal/anual) que existem hoje em
     `src/pages/planos/index.tsx`.
3. `/termos` no marketing reproduz o conteúdo de `src/pages/Termos.tsx` sem
   alteração de texto.
4. `/privacidade` no marketing reproduz as seções 1 a 6 de
   `src/pages/Privacidade.tsx` (resumo, quem somos, o que coletamos, tabela de
   retenção, compartilhamento, cookies, direitos LGPD, DPO), **sem** os blocos
   "Solicitar exclusão dos meus dados" e "Solicitar exportação dos meus dados".
   No lugar desses blocos, um parágrafo aponta pra
   `https://app.pilarsoft.com.br/login` explicando que essas ações ficam em
   Configurações → Privacidade, autenticado.
5. O app raiz ganha `PrivacidadePanel.tsx` em
   `src/components/settings/panels/`, com o comportamento exato de
   `handleRequestExport`/`handleRequestDeletion` de `src/pages/Privacidade.tsx`
   hoje (mesmas RPCs `request_data_export`/`request_data_deletion`, mesmo
   `useAuth()`), registrado no rail do `SettingsDialog` ao lado de Conta/Empresa/
   Pagamento/Uso/Segurança/Novidades. O painel linka "ver política completa" pra
   `https://pilarsoft.com.br/privacidade`.
6. `src/App.tsx` remove as rotas `<Route path="/planos">`,
   `<Route path="/termos">` e `<Route path="/privacidade">` (as que renderizavam
   página) e adiciona 3 redirects externos no padrão de `LandingRedirect`
   (`window.location.replace` pro domínio do marketing), preservando os
   bookmarks/links antigos.
7. `src/pages/Termos.tsx`, `src/pages/Privacidade.tsx`,
   `src/pages/planos/index.tsx`, `src/pages/landing/components/LandingHeader.tsx`
   e `src/pages/landing/components/LandingFooter.tsx` são deletados do app raiz
   (conteúdo migrado ou incorporado ao painel; header/footer duplicados viram
   código morto).
8. `src/pages/planos/hooks/usePlans.ts`, `components/CycleToggle.tsx` e
   `components/PlanCard.tsx` continuam no app raiz sem alteração de contrato
   (import path igual), porque `Checkout` e `ChangePlanDialog` dependem deles.

Requisitos não-funcionais:

- **Segurança:** a chave usada pelo `fetch` do marketing é a mesma
  `publishable`/`anon` já pública no app raiz — nenhuma credencial nova exposta.
  `apps/marketing/vercel.json` `connect-src` ganha `https://*.supabase.co`
  (único domínio novo permitido).
- **Sem regressão:** `Checkout` e `ChangePlanDialog` continuam funcionando
  exatamente como hoje (mesmos imports de `src/pages/planos/`).
- **LGPD:** as duas ações (exportar/excluir dados) continuam chamando as mesmas
  RPCs com o mesmo comportamento — é mudança de onde o botão mora, não do que
  ele faz.

## Critérios de aceite

- [ ] Dado que estou em `pilarsoft.com.br` (qualquer seção), quando clico em
      "Ver planos" no header ou no CTA final, então navego para
      `pilarsoft.com.br/planos` sem reload de página (SPA), vendo a grade de
      planos carregada via `fetch`.
- [ ] Dado `apps/marketing` rodando local (`npm run dev --workspace=apps/marketing`),
      quando acesso `/termos` e `/privacidade`, então o conteúdo bate com o que
      existia antes em `src/pages/Termos.tsx`/`Privacidade.tsx` (menos os blocos
      de ação de dados, no caso de Privacidade).
- [ ] Dado um usuário logado no app, quando abre Configurações → Privacidade,
      então vê os botões "Solicitar exclusão de dados" e "Solicitar exportação
      de dados" funcionando (mesmas RPCs, mesmo toast de sucesso/erro).
- [ ] Dado um usuário deslogado que acessa `app.pilarsoft.com.br/planos` (link
      antigo salvo), quando a página carrega, então é redirecionado pra
      `https://pilarsoft.com.br/planos` (idem para `/termos` e `/privacidade`).
- [ ] Dado o fluxo de `Checkout` ou "Trocar de plano" (Configurações →
      Pagamento), quando executo o fluxo, então nada quebra (mesmos dados,
      mesmo `usePlans`, mesmo `CycleToggle`).
- [ ] Dado `npm run typecheck && npm run lint && npm run test:run` no workspace
      raiz e `npm run typecheck --workspace=apps/marketing` no marketing, então
      ambos passam sem erro.
- [ ] Caso de borda: `pilar_subscription_plans` retorna vazio ou a chamada REST
      falha (rede/RLS) → `/planos` no marketing mostra um estado de erro/vazio
      equivalente ao que `Planos` (app) mostra hoje (`isLoading`/`error`/lista
      vazia), não uma tela quebrada.

## Dados e contratos

- Nenhuma migration nova. `pilar_subscription_plans` já tem `GRANT SELECT` pra
  `anon` (`supabase/migrations/20260507100000_restore_pilar_plans_grants.sql`).
- Contrato novo: chamada REST direta (sem `supabase-js`) contra
  `${VITE_SUPABASE_URL}/rest/v1/pilar_subscription_plans`, filtrando
  `ativo=eq.true`, ordenando por `ordem`. Mesma forma de dado que `usePlans` já
  retorna hoje (`Plan[]`), só que buscada por `fetch` cru em vez do client.
- `apps/marketing` ganha duas env vars: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY` (mesmos valores de staging/produção do app
  raiz, configurados no projeto Vercel do marketing).

## Plano de implementação

1. **Termos**: criar `apps/marketing/src/pages/Termos.tsx` com o conteúdo de
   `src/pages/Termos.tsx` (troca só `Link`/`react-router-dom` se o app raiz usar
   algo que o marketing não tenha; o marketing já usa `react-router-dom`, então
   é praticamente cópia direta). Adicionar rota em `apps/marketing/src/App.tsx`.
   Deletar `src/pages/Termos.tsx`.
2. **Privacidade — metade estática**: criar
   `apps/marketing/src/pages/Privacidade.tsx` com as seções 1-6 de
   `src/pages/Privacidade.tsx`, trocando os dois blocos de ação por um
   parágrafo linkando pro login do app. Adicionar rota.
3. **Privacidade — metade autenticada**: criar
   `src/components/settings/panels/PrivacidadePanel.tsx` no app raiz, movendo
   `handleRequestExport`/`handleRequestDeletion`/estado relacionado de
   `src/pages/Privacidade.tsx` pra lá. Registrar no rail do `SettingsDialog`
   (ver como os outros painéis — `ContaPanel`, `SegurancaPanel` — se registram).
   Deletar `src/pages/Privacidade.tsx`.
4. **Planos**: criar `apps/marketing/src/pages/Planos.tsx` reproduzindo a UI de
   `src/pages/planos/index.tsx` (hero, `PlanSkeleton`, `EnterpriseCard`,
   `CycleToggle`, grade de `PlanCard`), mas com fetch REST próprio em vez de
   `usePlans`/react-query (`useState`+`useEffect` com `fetch`, tratando
   loading/error/vazio equivalente). Adicionar rota `/planos` em
   `apps/marketing/src/App.tsx`. Adicionar `VITE_SUPABASE_URL`/
   `VITE_SUPABASE_PUBLISHABLE_KEY` a `apps/marketing/.env.example` (criar se não
   existir) e documentar que precisam ser configuradas no Vercel do marketing.
   Deletar `src/pages/planos/index.tsx` (manter `hooks/`, `components/` usados
   por `Checkout`/`ChangePlanDialog`).
5. **CSP do marketing**: em `apps/marketing/vercel.json`, adicionar
   `https://*.supabase.co` ao `connect-src`.
6. **Redirects no app raiz**: em `src/App.tsx`, trocar as 3 rotas
   `<Route path="/planos" element={<Planos />} />` (e as de Termos/Privacidade)
   por redirects externos no padrão de `LandingRedirect` (componente reutilizável
   parametrizado por path, ex. `ExternalRedirect({ to })`), removendo os
   imports `lazy` correspondentes.
7. **Limpeza**: deletar `src/pages/landing/components/LandingHeader.tsx` e
   `LandingFooter.tsx` (confirmar antes, via grep, que nenhum outro arquivo além
   do já removido `planos/index.tsx` os importa).
8. **Links da LP**: conferir que `apps/marketing/src/components/LandingHeader.tsx`
   e `CTASection.tsx` continuam usando `${APP_URL}/planos` etc. — na verdade
   esses viram links **internos** (`<Link to="/planos">` do próprio router do
   marketing) em vez de `<a href={APP_URL + ...}>`, já que a página passa a
   morar no mesmo app. Login/Cadastro continuam como `<a>` absoluto pro app.
9. Rodar `npm run typecheck && npm run lint && npm run test:run` na raiz e
   `npm run typecheck --workspace=apps/marketing`, mais checagem visual local
   dos três fluxos (LP → Planos, LP → Termos/Privacidade, Configurações →
   Privacidade logado, Checkout, Trocar de plano).

## Decisões e riscos

- Decisão de arquitetura registrada em [ADR 0025](../architecture/adr/0025-planos-termos-privacidade-para-marketing.md).
- **Risco:** o cutover de `pilarsoft.com.br` pro deploy do marketing já foi
  feito (conforme `LandingRedirect` em produção); então mover `/planos`/`/termos`/
  `/privacidade` pra lá é aditivo ao domínio que já está no ar, mas ainda exige
  configurar as env vars novas no projeto Vercel do marketing antes do deploy
  ou a página de planos quebra silenciosamente (mitigar com o estado de erro do
  critério de aceite correspondente).
- **Risco:** abrir `connect-src` pro Supabase no CSP do marketing é a única
  regressão de superfície de ataque desta spec — aceito porque a chave é
  pública por design (mesma do app raiz) e o `fetch` é só leitura de uma tabela
  já `GRANT SELECT` pra `anon`.
- **Suposição que pode furar:** que ninguém além de `planos/index.tsx` importa
  `src/pages/landing/components/{LandingHeader,LandingFooter}.tsx` — confirmado
  por grep nesta investigação (2026-08-18), mas reconfirmar no passo 7 antes de
  deletar, caso algo tenha mudado entre a spec e a implementação.
