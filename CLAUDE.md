# Pilar — Claude Context

## Scripts

```
npm run dev           # ambiente local completo: Supabase + migrations pendentes + functions + app + LP marketing
npm run dev:app        # só o Vite do app (sem Supabase/functions/LP)
npm run dev:marketing  # só o Vite da LP (apps/marketing)
npm run dev:all        # app + LP juntos, sem Supabase (front puro, mais rápido, não exige Docker)
npm run dev:local      # Supabase + migrations pendentes + functions + app (sem LP marketing)
npm run build:strict # Build com typecheck
npm run typecheck    # tsc sem emitir
npm run test         # Vitest watch
npm run test:run     # Vitest CI
npm run gen:types    # tipos do banco de STAGING (default seguro, ADR 0007)
npm run gen:types:local          # tipos do banco LOCAL (após criar migration no dev local)
npm run db:push:staging          # aplica migrations em staging
npm run functions:deploy:staging # deploya edge functions em staging
```

`npm run dev` (e `dev:local`) aplicam as migrations pendentes no banco local
automaticamente (`supabase migration up`, incremental, não apaga dados): criou
migration, é só rodar/reiniciar o `dev` e ela entra. Para os tipos refletirem o
schema local, rode `gen:types:local`. Antes de PR/deploy, a migration vai pro
staging e o `types.ts` canônico fecha com `gen:types` (staging).

`npm run dev` exige Docker rodando (sobe o Supabase local). Pra trabalhar só no
front sem Docker, use `dev:app` (só o app) ou `dev:all` (app+LP).

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

## UI e design system

Antes de escrever QUALQUER UI (tela, modal, componente), consultar
`docs/design/PILAR_DESIGN_SYSTEM.md`: é o contrato visual (o que existe, quando
usar, o que é proibido). Regras que valem sempre:

- Página nova usa `PilarPage`; modal de formulário usa `FormDialog` (largura só
  `sm`/`md`/`lg`). Não remontar `PageLayout`+`PageHeader` nem `DialogContent`+footer à mão.
- Cor só por token semântico de `src/styles/tokens.css`. Nunca paleta crua
  (`bg-red-100`, `text-amber-700`); o ESLint barra.
- Botão primário é `variant="brand"`, nunca `className="bg-brand..."`. Status via
  `StatusBadge` do registry (`src/lib/status.ts`). Dinheiro/data via `@/lib/format`.
  Exclusão via `ConfirmDialog`. Campo de dinheiro via `MoneyInput`.
- Componente genérico faltando e repetido 3+ vezes: promover (regra dos 3 usos,
  ADR 0008), não copiar. Regra de domínio: escrever à mão.
- Tabela plana (listagem com ordenação/seleção) usa `DataTable`
  (`src/components/data/DataTable.tsx`, sobre `@tanstack/react-table`), não
  `<table>` à mão. Empty/erro ricos via os slots `emptyState`/`errorState`.
  Exceção: tabela server-side + agrupada + scroll infinito (ex. `LancamentosTable`)
  fica custom. Matemática de timeline/Gantt vem de `src/lib/cronograma.ts`, nunca
  reimplementada na tela. Ver [ADR 0020](docs/architecture/adr/0020-headless-sim-widget-estilizado-nao.md)
  e [SPEC 041](docs/specs/041-adocao-tanstack-table-e-consolidacao-gantt-kanban.md):
  headless (TanStack/dnd-kit) sim, widget estilizado (DHTMLX/ag-Grid) não.

## Documentação

Toda a documentação vive em `docs/`, organizada por tema com índices navegáveis.
Comece por `docs/README.md` (índice mestre).

**Decisões de direção do CEO: `docs/strategy/DECISOES.md`** (log vivo, mais recente primeiro).
Toda decisão de direção nova entra lá na hora; quando conflitar com doc de estratégia mais
antigo, vale o DECISOES.md. Os agentes de time (`.claude/agents/`) leem esse arquivo antes de
qualquer análise (protocolo escrito nos próprios agentes). Decisão sensível (segurança, marca)
fica fora do repo público, na memória do projeto. Temas: `strategy/` (produto, ICP,
roadmap, **pricing**, concorrência), `security/` (segurança, compliance, auditoria),
`operations/` (deploy, DR, incident, runbooks, monitoring), `architecture/` (ADRs),
`legal/`. Inteligência de mercado em `research/` (índice `research/INDEX.md`).

## Marca (copy, landing, UI text, material de venda)

Antes de escrever QUALQUER texto voltado ao usuário — landing, microcopy de UI,
e-mail, deck, anúncio — consultar `brand/BRAND.md` (índice) e o arquivo específico:
voz/tom → `brand/voice-tone.md`, visual → `brand/visual.md`, mensagens → `brand/messaging.md`,
público → `brand/personas.md`. Cor/token: a verdade é `src/styles/tokens.css`.

- Tagline: "Saiba se cada projeto está dando lucro antes de terminar."
- ICP: escritórios de projeto técnico — engenharia multidisciplinar (civil/estrutural/MEP) e
  arquitetura (desde 2026-09-01, ver DECISOES.md) — NÃO construtora/incorporadora.
- Voz: direta, técnica na medida, confiante, sem hype. Ver palavras banidas em voice-tone.md.

## DB

183 migrations em `supabase/migrations/`, dois esquemas convivendo: 000..029 (antigo) e
timestamp 2026*. Tipos gerados em `src/integrations/supabase/types.ts`.
Rodar `npm run gen:types` após qualquer migration, e commitar o `types.ts`. O CI **valida
isso**: o job `types-sync` (Fase 1 do `docs/operations/PLANO_ENGENHARIA_2026-07.md`, já
implementada) bloqueia o merge quando o `types.ts` commitado diverge do schema das
migrations. Esquecer de rodar o `gen:types` reprova o PR, não vaza para runtime.

## Git, branches e release (REGRA INQUEBRÁVEL)

Fluxo e higiene não negociáveis. Aplicar sempre, sem perguntar, em toda mudança:

O repo permite squash e rebase, mas BLOQUEIA merge commit.

**Branches**

- Feature/fix nasce de `origin/staging` e o PR vai SEMPRE para `staging`, nunca direto para `main`.
- Merge do PR de feature com `gh pr merge <n> --rebase --delete-branch`: preserva os commits em linha e mantém `staging` linear. Curar a branch antes (sem commits "wip/typo"), porque o rebase reaplica todos no log.
- Zero commit direto em `staging` ou `main`.
- Entre trabalhos só sobrevivem `main` e `staging`. Nenhuma branch órfã.

**Promoção staging→main (release)**

- NUNCA PR direto de `staging` para `main`: o histórico divergiu (releases antigos foram squash) e qualquer método por replay (rebase ou merge) dá conflito falso.
- Método correto: branch `release/staging-AAAA-MM-DD[-slug]` a partir de `origin/main`, depois `git read-tree --reset -u origin/staging`, `git commit --no-verify`, e PR para `main`. Isso vira UM commit cuja árvore = `staging`, sem replay de histórico.
- Merge do PR de release com `gh pr merge <n> --admin --squash --delete-branch` (`enforce_admins=false` deixa o admin passar o review requerido). Como a branch release já é 1 commit, squash e rebase são equivalentes aqui.
- Só mergear com TODOS os checks verdes, incluindo Security audit e "types.ts em sync".

**Limpeza obrigatória após CADA merge**

- Deletar a branch merged, local e remota (`--delete-branch`, ou `git branch -D` + `git push origin --delete`).
- Fechar manualmente as issues resolvidas: `Closes #` não dispara porque o merge é em `staging`, não na branch default `main`. Comentar o PR/commit que corrigiu.
- Trocar para `staging`, `git pull --ff-only`, e apagar as branches locais já merged.

**Verificação de fecho**

- Após o release, confirmar `git diff --stat origin/main origin/staging` vazio (árvore idêntica = promoção completa).
