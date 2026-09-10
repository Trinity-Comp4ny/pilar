# SPEC: Instrumentação de eventos de produto (ativação, retenção, adoção, funil trial→pagante)

**Data:** 2026-09-08
**Status:** Entregue
**Autor:** Matheus Rezende
**Módulo:** cross-cutting (analytics)

## Problema

Gate 4 do checklist de lançamento (auditoria 2026-08-28, revalidado 2026-09-08) está vermelho:
a infra de analytics existe (PostHog + consent + PII scrubbing em `src/lib/analytics.ts`), mas só
2 eventos são disparados no código inteiro (`$pageview` e `inicio_agentes_abrir`), e
`analytics.identify()` nunca é chamado. Sem identify, todo pageview é anônimo: não dá pra
segmentar por empresa, por plano, nem medir retenção de verdade (cada sessão pode virar uma
"pessoa" nova pro PostHog). Sem lançar sabendo se o cliente ativa, volta e usa os módulos que
paga, é vender no escuro.

## Objetivo

Depois desta spec, dá pra responder no PostHog, sem código novo: (1) quantas empresas ativaram
(criaram 1º projeto) em até N dias do signup; (2) quantas voltaram na semana seguinte, por
empresa; (3) quais módulos cada empresa usa (via breakdown de `$pageview` por `modulo`); (4) taxa
de conversão trial → assinatura ativa, e onde o funil vaza (checkout iniciado vs. concluído).

**Fora de escopo:** DPIA/analytics review formal, dashboards prontos no PostHog (isso é
configuração de insight, não código), tracking server-side via `posthog-node` nas edge functions
(webhook do Asaas já grava status em `pilar_subscriptions`; captura client-side na página que lê
esse status já cobre o funil sem exigir SDK novo no Deno).

## Requisitos

1. Todo evento carrega identidade quando o usuário está logado: `analytics.identify(user.id, {email, empresa_id, role})` chamado sempre que o profile carrega (mesmo call site que já chama `monitoring.setUser`).
2. `analytics.reset()` é chamado no logout (hoje só `monitoring.setUser(null)` é chamado; sem reset, o próximo login no mesmo browser herda o distinct_id anterior).
3. `$pageview` carrega o módulo da rota (`routeToModule(pathname)`) como property, sem exigir evento novo pra medir adoção por módulo.
4. Sinais de ativação viram evento: conta criada, onboarding concluído, 1º projeto criado.
5. Sinais do funil comercial viram evento: checkout de assinatura iniciado, assinatura ativada (transição para `status === "paid"`), compra de pacote de tokens concluída, proposta muda de status (funil comercial do cliente do Pilar, não o funil de assinatura do Pilar em si, mas mesma lógica de instrumentação).
6. Nenhum evento novo muda comportamento observável pelo usuário (toast, navegação, validação) — é só telemetria adicionada ao lado de um fluxo que já existe.

Requisitos não-funcionais:

- **Privacidade:** todo `properties` passa pelo `scrub()` que já existe (automático, é o mesmo `analytics.track`) — não adicionar CPF/CNPJ/valor monetário cru em property de evento (money vira faixa ou fica de fora).
- **Consentimento:** nada muda aqui — `analytics.track`/`identify` já são no-op sem `getCookieConsent().analytics`.
- **Sem quebra de comportamento:** todo `track()`/`identify()` novo é adicionado ao lado de um efeito que já existe (toast, navegação, `monitoring.recordMetric`), nunca substituindo.

## Critérios de aceite

- [ ] Dado um usuário loga, quando o profile carrega, então `analytics.identify` é chamado com `empresa_id` e `role`.
- [ ] Dado um usuário desloga, quando `signOut` roda, então `analytics.reset()` é chamado.
- [ ] Dado o usuário navega para `/gestao/financeiro`, quando o `$pageview` dispara, então a property `modulo` vem `"gestao"`.
- [ ] Dado um signup bem-sucedido, então `signup_completed` dispara antes do redirect.
- [ ] Dado o onboarding (`CompanySetup`) salva com sucesso, então `empresa_onboarding_concluido` dispara.
- [ ] Dado `create_projeto_completo` retorna sucesso, então `projeto_criado` dispara.
- [ ] Dado o form de checkout é enviado, então `checkout_iniciado` dispara com `plano` e `ciclo` (sem valor monetário cru, plano já identifica o preço).
- [ ] Dado o status do checkout vira `"paid"` pela primeira vez (guard por ref, mesmo padrão do `monitoring.recordMetric("checkout.completed", ...)` já existente), então `assinatura_ativada` dispara.
- [ ] Dado a compra de pacote de tokens confirma pagamento, então `pacote_tokens_comprado` dispara.
- [ ] Dado uma proposta muda de status via `handleStatusChange`, então `proposta_status_alterado` dispara com o novo status.

## Dados e contratos

Nenhuma tabela nova. Nenhuma migration. Eventos batem só no PostHog (via `analytics.track`),
que já está com consent+scrub configurados. Nomenclatura de evento em `snake_case`, português,
consistente com `inicio_agentes_abrir` (evento já existente).

## Plano de implementação

1. `src/contexts/AuthContext.tsx`: chamar `analytics.identify` dentro de `fetchProfile` (ao lado
   de `monitoring.setUser`) e `analytics.reset()` dentro de `signOut`.
2. `src/hooks/usePageTracking.ts`: adicionar `modulo: routeToModule(location.pathname)` ao
   `$pageview`.
3. `src/pages/Signup.tsx`: `signup_completed` no callback de sucesso de `handleSignup`.
4. `src/pages/CompanySetup.tsx`: `empresa_onboarding_concluido` antes do `toast.success` (linha 79).
5. `src/pages/projetos/components/useProjetoForm.ts`: `projeto_criado` após sucesso de
   `create_projeto_completo` (linha 632).
6. `src/pages/checkout/index.tsx`: `checkout_iniciado` no `onSubmit` do `CheckoutForm` (linha 98);
   `assinatura_ativada` no mesmo `useEffect`/guard-ref que já dispara
   `monitoring.recordMetric("checkout.completed", ...)` (linha 43-50).
7. `src/pages/comprar-tokens/index.tsx`: `pacote_tokens_comprado` quando `paid` vira `true`
   (mesmo guard por ref pra não duplicar em re-render).
8. `src/pages/propostas/index.tsx`: `proposta_status_alterado` no `onSuccess` de
   `handleStatusChange` (linha 319-327).

## Decisões e riscos

- Não abre ADR: é instrumentação aditiva sobre infra já decidida (ADR 0022/0032, consent).
- Risco: eventos de funil de assinatura (`checkout_iniciado`/`assinatura_ativada`) só cobrem o
  caminho client-side; se o Asaas mudar status via webhook sem o usuário estar com a aba de
  checkout aberta (ex. renovação automática de assinatura recorrente), esse evento específico não
  dispara. Aceitável agora porque zero pagante existe hoje (ver DECISOES.md 2026-09-01); revisar
  se volume de renovação recorrente começar a importar.
- Dashboards/funis no PostHog (não código) ficam como próximo passo depois que os eventos
  começarem a chegar; não é parte desta spec.
