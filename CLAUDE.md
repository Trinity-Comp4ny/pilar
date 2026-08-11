# Pilar — Claude Context

## Scripts

```
npm run dev          # Vite dev server (só o front)
npm run dev:local    # ambiente local completo: Supabase + migrations pendentes + functions + Vite
npm run build:strict # Build com typecheck
npm run typecheck    # tsc sem emitir
npm run test         # Vitest watch
npm run test:run     # Vitest CI
npm run gen:types    # tipos do banco de STAGING (default seguro, ADR 0007)
npm run gen:types:local          # tipos do banco LOCAL (após criar migration no dev local)
npm run db:push:staging          # aplica migrations em staging
npm run functions:deploy:staging # deploya edge functions em staging
```

`dev:local` aplica as migrations pendentes no banco local automaticamente
(`supabase migration up`, incremental, não apaga dados): criou migration, é só
rodar/reiniciar o `dev:local` e ela entra. Para os tipos refletirem o schema
local, rode `gen:types:local`. Antes de PR/deploy, a migration vai pro staging e
o `types.ts` canônico fecha com `gen:types` (staging).

Comando que muta banco ou funções exige ambiente explícito e passa por
`scripts/supabase-target.sh`. Produção só com `ALLOW_PROD_DB_PUSH=true`. Ver ADR 0007.

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

## Documentação

Toda a documentação vive em `docs/`, organizada por tema com índices navegáveis.
Comece por `docs/README.md` (índice mestre). Temas: `strategy/` (produto, ICP,
roadmap, **pricing**, concorrência), `security/` (segurança, compliance, auditoria),
`operations/` (deploy, DR, incident, runbooks, monitoring), `architecture/` (ADRs),
`legal/`. Inteligência de mercado em `research/` (índice `research/INDEX.md`).

## Marca (copy, landing, UI text, material de venda)

Antes de escrever QUALQUER texto voltado ao usuário — landing, microcopy de UI,
e-mail, deck, anúncio — consultar `brand/BRAND.md` (índice) e o arquivo específico:
voz/tom → `brand/voice-tone.md`, visual → `brand/visual.md`, mensagens → `brand/messaging.md`,
público → `brand/personas.md`. Cor/token: a verdade é `src/styles/tokens.css`.

- Tagline: "Saiba se cada projeto está dando lucro antes de terminar."
- ICP: engenharia multidisciplinar (civil/estrutural/MEP) — NÃO arquitetura nem construtora.
- Voz: direta, técnica na medida, confiante, sem hype. Ver palavras banidas em voice-tone.md.

## DB

183 migrations em `supabase/migrations/`, dois esquemas convivendo: 000..029 (antigo) e
timestamp 2026*. Tipos gerados em `src/integrations/supabase/types.ts`.
Rodar `npm run gen:types` após qualquer migration, e commitar o `types.ts`: **nenhum job
de CI valida isso hoje**, então esquecer gera código que passa no typecheck e quebra em
runtime. Ver `docs/operations/PLANO_ENGENHARIA_2026-07.md` (Fase 1) para o gate que fecha
esse buraco.
