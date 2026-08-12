# ADR 0016: Aninhar as rotas por módulo (`/<modulo>/<aba>`)

**Data:** 2026-08-12
**Status:** Accepted

## Contexto

A plataforma tem três módulos de navegação (`gestao`, `projetos`, `obras`), mas as URLs
não refletiam essa hierarquia de forma consistente. As abas de Gestão eram flat de topo
(`/clientes`, `/leads`, `/financeiro`), Projetos misturava flat e aninhado, e Obras já tinha
`/obras/clima` aninhado ao lado de `/fornecedores` flat. Três forças empurravam a decisão:

- **Colisão de nomes genéricos.** Nomes como `/cronograma` e `/mapa` no topo só podem ter
  um dono. Obras (ADR 0011) é fase de execução do projeto e vai querer o próprio cronograma
  e mapa; flat inviabiliza isso.
- **Classificação de rota frágil.** `routeToModule` precisava registrar cada rota flat; uma
  rota nova podia "escapar" da classificação de módulo.
- **Consistência.** `/obras/clima` já estabelecia o padrão de aninhar sub-lente sob o módulo.

Opções consideradas:

- **Flat de topo** (`/clientes`, `/cronograma`): URL curta, mas nome genérico ocupa o topo e
  colide entre módulos.
- **Aninhar por módulo** (`/gestao/clientes`, `/projetos/cronograma`): a URL comunica o dono,
  `routeToModule` vira prefixo automático (`/<modulo>/*`), namespacing evita colisão.

## Decisão

Usar `/<modulo>/<aba>` para toda rota que pertence a um módulo. Cada aba de Gestão passa a
`/gestao/*`, Fornecedores vai para `/obras/fornecedores`, e Calendário para `/projetos/calendario`.
Rotas transversais (que `routeToModule` classifica como `null`) ficam flat: `/inicio`,
`/agentes`, `/profile`, auth, `/admin`, `/portal`, `/cliente/*`, `/billing`, `/company`.

De-para principal:

```
/meu-trabalho → /gestao/meu-trabalho      /clientes      → /gestao/clientes
/leads        → /gestao/leads             /documentos    → /gestao/propostas
/financeiro   → /gestao/financeiro        /equipe        → /gestao/equipe
/metas        → /gestao/metas             /fornecedores  → /obras/fornecedores
/calendario   → /projetos/calendario      (projetos já aninhado: disciplinas/cronograma/mapa)
```

- `/gestao` redireciona para `/gestao/meu-trabalho` (primeira aba). `/projetos` e `/obras` já
  são a tela principal do módulo (não viram `/projetos/projetos`).
- **Compatibilidade:** toda rota flat antiga vira redirect para a nova. `RedirectPrefix`
  (`src/App.tsx`) preserva o sufixo (`/clientes/123` → `/gestao/clientes/123`) e a query.
  Emails em produção só usam `/cliente/*` e `/billing`, que **não** mudam.
- Rotas estáticas (`/projetos/disciplinas`) declaradas antes de `/projetos/:id`; o React
  Router v6 prioriza segmento estático sobre dinâmico.
- Fonte de navegação: `src/lib/modules.ts` (items) + `src/App.tsx` (rotas). Não há arquivo
  central de rotas; os ~40 call-sites hardcoded foram atualizados para as rotas novas.

## Consequências

**Positivas:**

- A URL comunica o módulo dono; `routeToModule` classifica por prefixo `/<modulo>/*` sem
  registrar cada rota.
- Nomes de lente (`cronograma`, `mapa`) ficam livres para outros módulos usarem os seus.
- Redirects de compat mantêm todo link antigo (bookmark, email, link interno) funcionando.

**Negativas:**

- URLs mais longas.
- Sem arquivo central de rotas, os call-sites hardcoded seguem espalhados; a dívida de
  centralizar (um `paths.ts`) continua aberta. Os redirects de compat viram peso morto a
  ser removido no futuro.
- Rotas compartilhadas (Clientes, Leads) ficam ancoradas ao dono canônico (`gestao`); mover
  uma aba de módulo depois muda a URL.

## Decisões relacionadas

- ADR 0011: reabrir Obras como fase de execução do projeto (motiva o namespacing p/ Obras).
- Migration/PR: reorg aplicada em `src/App.tsx`, `src/lib/modules.ts` e ~15 arquivos de UI.
