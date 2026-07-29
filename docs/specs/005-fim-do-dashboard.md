# SPEC: Fim do Dashboard, Início como home única

**Data:** 2026-07-28  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** projetos, financeiro

## Problema

A tela `/dashboard` é a home do módulo Projetos, mas ~60% do que ela mostra é
financeiro (receita, despesa, saldo, a receber, fluxo, vencimentos). Financeiro
pertence à Gestão, não a Projetos. Resultado: o usuário de projetos abre uma tela
que mistura dois pilares, e o mesmo número financeiro aparece em dois lugares com
cálculo diferente (Dashboard usa `useDashboardData`, o Financeiro usa
`useFinanceData`).

## Objetivo

Acabar com a tela Dashboard. O conteúdo operacional passa a viver na Início
(`/inicio`, que já é a home pós-login), o conteúdo financeiro já vive na Visão
Geral do Financeiro. Depois disto não existe mais uma tela que mistura os pilares,
e `/inicio` é o único ponto de entrada.

**Fora de escopo:**

- Não redesenhar a Visão Geral do Financeiro (ela já cobre os KPIs financeiros).
- Não criar métrica financeira nova.
- Não mexer no radar de agentes da Início além de evitar duplicar alertas.
- Não unificar `useDashboardData` e `useFinanceData` (dívida separada).

## Requisitos

Funcionais, testáveis:

1. `/dashboard` redireciona para `/inicio` (rota mantida como atalho, sem tela própria).
2. O módulo Projetos não lista mais "Dashboard" no menu. Seu `homeRoute` passa a
   ser `/projetos` (a listagem, coração do módulo): `/inicio` é transversal, não é
   item de nenhum módulo, e o switcher precisa abrir uma tela do próprio pilar. A
   home pós-login continua sendo `/inicio` (via login e redirects), o que é
   independente do `homeRoute` do switcher.
3. A Início mostra os blocos **operacionais** que estavam no Dashboard:
   - Projetos ativos com progresso de prazo (lista).
   - Calendário de prazos.
   - Pipeline de leads (só se `can("leads")`).
4. Os alertas operacionais não são duplicados: o radar de agentes da Início já
   cobre vencimentos e prazos estourados; não renderizar um segundo bloco de alertas.
5. O único bloco financeiro sem equivalente na Visão Geral, **Próximos
   Vencimentos**, é levado para a Visão Geral do Financeiro.
6. Todo redirect pós-login/onboarding/MFA que hoje aponta para `/dashboard` passa a
   apontar para `/inicio`.
7. O gate de ultra-admin que dependia de `pathname === "/dashboard"` passa a checar
   `/inicio` (hoje já está morto, porque o login manda para `/inicio`).

Não-funcionais:

- **Multi-tenant:** nenhum hook novo; reuso de `useDashboardData`/`useFinanceData`,
  isolamento por `empresa_id` inalterado.
- **Permissões:** cada bloco na Início respeita o mesmo gate que tinha no Dashboard
  (`canProj`, `canLeads`, `canFin`).
- **Sem número novo:** a Início não recalcula financeiro; reusa o que já existe.

## Critérios de aceite

- [ ] Dado usuário autenticado, quando acessa `/dashboard`, então é redirecionado
      para `/inicio` (replace, sem entrada no histórico).
- [ ] Dado o menu do módulo Projetos, então não há item "Dashboard".
- [ ] Dado que troco para o módulo Projetos, quando clico no switcher, então vou
      para `/inicio`.
- [ ] Dado usuário com permissão de projetos, quando abre `/inicio`, então vê a
      lista de projetos ativos com progresso de prazo e o calendário de prazos.
- [ ] Dado usuário sem `can("leads")`, quando abre `/inicio`, então não vê o
      pipeline de leads.
- [ ] Dado usuário na Visão Geral do Financeiro, então vê Próximos Vencimentos.
- [ ] Dado login concluído / onboarding / MFA, quando o fluxo redireciona, então o
      destino é `/inicio`, nunca `/dashboard`.
- [ ] Caso de borda: usuário ultra-admin logando cai no gate correto a partir de
      `/inicio`.
- [ ] Suíte de testes que referenciava `/dashboard` (PrivateRoute, PageHeader,
      modules, rbac) atualizada e verde.

## Dados e contratos

Nenhuma migration. Nenhuma RPC nova. Só reuso de hooks existentes
(`useDashboardData`, `useFinanceData`) e realocação de componentes de UI.

## Plano de implementação

A aprovar antes de codar.

1. **Rota:** em `App.tsx`, trocar `element={<Dashboard />}` por
   `<Navigate to="/inicio" replace />` em `/dashboard`. Remover import de `Dashboard`.
2. **modules.ts:** `projetos.homeRoute → "/inicio"`; remover o item de menu
   "Dashboard". Ajustar `modules.test.ts`.
3. **Início:** adicionar à `src/pages/inicio/index.tsx` os blocos operacionais,
   reaproveitando `ProjectRow`, `CalendarioPreview`, `LeadsFunnel` (mover de
   `pages/dashboard/components/` para onde fizer sentido, ou importar de lá até o
   cleanup). Respeitar os gates.
4. **Financeiro:** levar `VencimentoRow` + `proximosVencimentos` (de
   `useDashboardData`) para a `VisaoGeral.tsx`.
5. **Redirects:** trocar `/dashboard → /inicio` em `PrivateRoute.tsx` (linhas 117 e
   142), `Landing.tsx`, `CompanySetup.tsx`, `ProfileSetup.tsx`, `MfaSetupPage.tsx`,
   `MfaChallengePage.tsx`, `NotFound.tsx`, `SemAcesso.tsx`, `CommandPalette.tsx`,
   `rbac.ts` (`DASHBOARD_BY_ROLE` / `dashboardForRole`).
6. **Cleanup:** remover `Dashboard.tsx` e os componentes usados só por ele que não
   foram reaproveitados (`AlertaRow`, `KPICard` legado, `DashboardSkeleton`,
   `DashboardFinanceChart` se não migrar o gráfico). Feature flag `dashboard`:
   avaliar se ainda faz sentido.
7. **Testes:** atualizar `PrivateRoute.test`, `PageHeader.test`, `modules.test`,
   `rbac.test`; `npm run typecheck` + `npm run test:run` verdes.

## Decisões e riscos

- **Decisão:** financeiro não vai para a Início; o resumo financeiro vive só na
  Visão Geral do Financeiro (decisão do CEO em 2026-07-28).
- **Risco:** `KPICard` tem dois componentes homônimos (`src/components/KPICard.tsx`
  compartilhado vs `src/pages/dashboard/components/KPICard.tsx` legado). Não confundir
  no cleanup.
- **Risco:** `CalendarioPreview` mora em `pages/projetos/components/` (operacional),
  não é legado do Dashboard; mover só a referência, não o arquivo.
- **Suposição:** o radar de agentes cobre bem o que os `AlertaRow` mostravam. Se não
  cobrir algum alerta, revisitar antes de descartar `AlertaRow`.
