# Pilar — Claude Context

## Stack

React 18 + TypeScript + Vite | Supabase (Postgres + Auth + Edge Functions Deno) | shadcn/ui + Tailwind | Vitest

## Scripts

```
npm run dev          # Vite dev server
npm run build:strict # Build com typecheck
npm run typecheck    # tsc sem emitir
npm run test         # Vitest watch
npm run test:run     # Vitest CI
npm run gen:types    # supabase gen types typescript
```

## Estrutura

```
src/
  pages/        # Uma pasta por módulo (projetos/, financeiro/, clientes/, etc.)
  components/   # UI compartilhado + hooks (use*.ts ficam aqui)
  hooks/        # Hooks globais
  contexts/     # AuthContext, ImpersonationContext
  integrations/supabase/  # client.ts + types.ts gerado
supabase/
  functions/    # Edge Functions Deno (cada uma em sua pasta)
  migrations/   # SQL numerado 001..026
```

## Módulos ativos (produção)

Dashboard, Projetos (Escopos + Aditivos), Propostas, Leads, Clientes,
Financeiro (Visão/Fluxo/Mensal/Folha/Faturas/Contas), Pessoas, Mapa,
Relatórios, Portal Cliente.

## Módulos dormentes (código existe, não usar em features novas sem avisar)

- Financeiro: Projeção de caixa, Aging, DRE, Rentabilidade, WIP
- Timesheet, Capacidade, Templates, Metas, Planejamento
- IA Hub: todas as 11 edge functions `ai-*`
- Asaas: backend pronto, UI zero

## Padrões

- Português BR em UI/comentários; inglês em commits/branches/PRs
- `useToast` do shadcn para feedback — sem `alert()`
- Early returns; sem `console.log` em código final
- RLS em toda tabela nova; testar com `auth.uid()` correto
- Edge Functions seguem padrão `_shared/cors.ts` + rate limiting por empresa

## DB

26 migrations em `supabase/migrations/`. Tipos gerados em `src/integrations/supabase/types.ts`.
Rodar `npm run gen:types` após qualquer migration.
