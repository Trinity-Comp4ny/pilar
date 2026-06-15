# Accelerator Intelligence — Base de Conhecimento

Base de conhecimento viva sobre startups, aceleradoras e fundos. Coleta contínua de
Y Combinator, a16z, Sequoia, First Round, Techstars/500 e fontes B2B SaaS / AI-native.

**Objetivo:** acumular contexto, ideias e inteligência acionável — com lente dupla:
1. **Amplo** — sabedoria geral de startups, aceleradoras, fundraising, GTM, PMF.
2. **Foco Pilar** — engenharia/AEC, vertical SaaS, AI-native, AI agents, pricing B2B.

Consumida pelo subagente `accelerator-intel` (`.claude/agents/accelerator-intel.md`).

## Estrutura

```
research/
  INDEX.md       # índice mestre de todas as notas, por fonte e por tema
  SOURCES.md     # ledger de fontes: backlog (pending) + captadas (done) — NÃO duplicar
  INSIGHTS.md    # top insights destilados, cross-source, acionáveis pro Pilar
  templates/note.md
  yc/            # Y Combinator: library, startup-school, lightcone, paul-graham, dalton-michael, rfs
  a16z/
  sequoia/
  first-round/
  techstars-500/ # Techstars, 500, SaaStr, Lenny, NfX, Bessemer, etc.
  themes/        # notas temáticas que cruzam fontes (fundraising, gtm, pricing, pmf, ai-agents...)
```

## Convenções

- **1 fonte = 1 arquivo `.md`** na pasta da fonte, com frontmatter (ver `templates/note.md`).
- Nome do arquivo: `kebab-case-do-titulo.md` (ex: `pg-do-things-that-dont-scale.md`).
- **Links entre notas:** `[[nome-do-arquivo-sem-extensao]]`.
- **Tags** controladas (lista canônica abaixo) — pra busca consistente.
- Toda nota tem `## Aplicação ao Pilar` — mesmo que seja "não se aplica diretamente".
- Notas temáticas em `themes/` sintetizam várias fontes; linkam de volta às notas-fonte.
- Datas relativas → absolutas (ISO `2026-06-10`).
- Nunca apagar uma fonte do `SOURCES.md`; mover de `pending` → `done` ou `skipped`.

## Tags canônicas

`fundraising` `gtm` `pricing` `pmf` `growth` `sales` `b2b-saas` `vertical-saas`
`ai-native` `ai-agents` `aec-engenharia` `founder-psychology` `hiring` `metrics`
`retention` `onboarding` `positioning` `marketplace` `defensibility` `moat`
`fundamentals` `idea-validation` `mvp` `unit-economics` `seed` `series-a`

## Workflow de coleta

1. Escolher fontes `pending` em `SOURCES.md` (prioridade alta primeiro).
2. Fetch → extrair → escrever nota no template → marcar `done` em `SOURCES.md`.
3. Atualizar `INDEX.md` (linha nova) e, se gerar insight forte, `INSIGHTS.md`.
4. Se a fonte revelar novas fontes (links, séries), adicionar como `pending`.

## Como usar o subagente

```
@accelerator-intel  o que YC/a16z dizem sobre pricing de AI agents por tarefa?
@accelerator-intel  expanda a base: capte os 10 próximos pending de prioridade alta
```
