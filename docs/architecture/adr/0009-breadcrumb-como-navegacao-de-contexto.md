# ADR 0009: Usar breadcrumb no PageHeader como navegação de contexto

**Data:** 2026-07-30
**Status:** Accepted

## Contexto

O app tem navegação por módulos na sidebar principal, mas nada indica onde o
usuário está _dentro_ de um módulo com subníveis (as 6 abas do Financeiro hoje;
telas de detalhe como Projeto amanhã). Havia um `src/components/ui/breadcrumb.tsx`
do shadcn instalado e nunca usado. Precisávamos decidir se e como adotar
breadcrumb como padrão antes de aplicá-lo no Financeiro (spec 006), porque a
escolha afeta o `PageHeader`, que é compartilhado por todas as telas de módulo.

Opções consideradas:

- **A. Breadcrumb derivado da rota (auto).** Um mapa `path → label` monta a trilha
  sozinho. Prós: zero prop por tela. Contras: não resolve folhas dinâmicas (nome
  do projeto vindo de dado), nem os subníveis do Financeiro que vivem em `?tab=`
  e não em rota; vira um mapa central que descasa do código real.
- **B. Prop `breadcrumbs` explícita no `PageHeader`.** Cada tela passa seus
  ancestrais. Prós: cada tela é dona da própria trilha, funciona para folha
  dinâmica e para subnível por estado; opcional, não quebra ninguém. Contras:
  repetição pequena por tela que quer trilha.
- **C. Barra de breadcrumb própria fora do `PageHeader`.** Uma segunda linha no
  topo. Contras: engrossa o header (hoje 56px, uma linha), pior no mobile,
  duplica um "topo" que o `PageLayout`/Financeiro já renderizam fixo.

## Decisão

Adotar a **Opção B**. O breadcrumb vive dentro do `PageHeader`, na mesma linha do
título, via prop opcional:

```ts
breadcrumbs?: Array<{ label: string; to?: string; onClick?: () => void }>
```

- Renderiza `Ancestral › Ancestral › title`. O `title` continua sendo a folha
  (o `<h1>`, `aria-current="page"`); `breadcrumbs` são só os ancestrais.
- Cada ancestral usa `to` (navega por rota, via `Link`) **ou** `onClick` (troca de
  contexto sem trocar de rota, ex.: voltar para a aba raiz do Financeiro).
- Sem a prop, o `PageHeader` mantém título + rótulo de módulo (nenhuma tela muda).
  Com a prop, o rótulo de módulo some (a trilha já dá o contexto).
- No mobile (`<sm`) os ancestrais somem e sobra só a folha, para manter a linha
  única.

Primeiro consumidor: Financeiro (spec 006). Telas de detalhe (Projeto, Cliente)
podem adotar depois, substituindo o botão "voltar" pela trilha.

## Consequências

**Positivas:**

- Padrão único de navegação de contexto, num só lugar (`PageHeader`), sem segunda
  barra e sem engrossar o header.
- Funciona tanto para subnível por estado (`?tab=`) quanto para rota real e folha
  dinâmica, porque a tela é dona da própria trilha.
- Adoção incremental: opt-in por tela, sem regressão nas existentes.

**Negativas:**

- Cada tela que quer trilha repete a montagem dos ancestrais (aceito: é explícito
  e local, melhor que um mapa central que descasa).
- A trilha some no mobile; a volta de contexto no mobile depende da sidebar/subnav
  (aceito para o estágio atual).

## Decisões relacionadas

- SPEC 006: Financeiro no header padrão + breadcrumb global (primeiro uso).
- ADR 0008: design system como fonte única (o breadcrumb usa os tokens do header).
- Estende a spec 002 (header padrão).
