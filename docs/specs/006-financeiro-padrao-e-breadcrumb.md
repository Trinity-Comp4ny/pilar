# SPEC: Financeiro no header padrão + breadcrumb global

**Data:** 2026-07-30
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** financeiro (+ shell)

## Problema

O Financeiro é a única tela de módulo fora do padrão de header do app. Ele
recria o container fixo na mão e usa um header próprio (título grande + subtítulo
"Gerencie receitas e despesas"), enquanto Início, Clientes, Leads e Propostas
usam o `PageHeader` fino (spec 002). O resultado: quem navega entre módulos sente
o Financeiro como "outra tela", e não há uma pista de contexto de onde se está
dentro das 6 abas do módulo.

## Objetivo

O Financeiro passa a usar o mesmo `PageHeader`/`PageLayout` das demais telas, e o
app ganha breadcrumb como navegação de contexto reaproveitável. Depois disto, o
topo do Financeiro é visualmente idêntico ao das outras páginas e a aba ativa
aparece como trilha clicável (`Financeiro › Fluxo de Caixa`).

**Fora de escopo:** transformar as abas do Financeiro em sub-rotas; aplicar
breadcrumb nas telas de detalhe (Projeto/Cliente) e trocar seus botões "voltar"
(fica para um passo seguinte); mudar qualquer cálculo financeiro.

## Requisitos

1. `PageHeader` aceita `breadcrumbs?: Array<{ label; to?; onClick? }>`: ancestrais
   clicáveis renderizados na mesma linha de 56px, com o `title` como folha.
2. Sem `breadcrumbs`, o `PageHeader` mantém o comportamento atual (título + rótulo
   de módulo). Nenhuma tela existente muda de aparência.
3. Com `breadcrumbs`, o rótulo de módulo some (a trilha já dá o contexto).
4. O Financeiro usa `PageLayout` (slot `sidebar` = `SecondSidebar` já existente) e
   `PageHeader`. O `FinanceiroHeader` é removido.
5. O título/breadcrumb do Financeiro acompanha a aba: raiz (Visão Geral) mostra só
   `Financeiro`; demais abas mostram `Financeiro › [aba]`, e clicar `Financeiro`
   volta para a Visão Geral.
6. O seletor de período vira um botão-popover compacto (`PeriodoPopover`) passado
   como ação do header, presente só nas abas que usam período (Visão Geral, Fluxo
   de Caixa). Presets à esquerda, calendário de intervalo à direita, toggle
   Diário/Mensal no rodapé (só na Visão Geral).

Requisitos não-funcionais:

- **Mobile:** header em uma linha; a trilha de ancestrais some em `<sm` e sobra só
  o título; o sub-nav das abas continua sendo a barra de pills horizontal da
  `SecondSidebar`. Sem scroll horizontal na página.
- **A11y:** trilha dentro de `<nav aria-label>`; folha é o `<h1>` com
  `aria-current="page"`; anúncio de rota do `PageLayout` preservado.

## Critérios de aceite

- [ ] Dado que abro `/financeiro`, então o topo é o header fino padrão, sem título
      grande nem subtítulo.
- [ ] Dado que troco para a aba Fluxo de Caixa, então o header mostra
      `Financeiro › Fluxo de Caixa` e o `document.title` vira `Pilar | Financeiro · Fluxo de Caixa`.
- [ ] Dado que estou numa aba não-raiz, quando clico em `Financeiro` na trilha,
      então volto para a Visão Geral.
- [ ] Dado que estou na Visão Geral, então não há trilha (só `Financeiro`).
- [ ] Dado que abro o `PeriodoPopover` e escolho "Mês passado", então o intervalo
      aplica e o rótulo do botão reflete o período.
- [ ] Caso de borda mobile (`<sm`): a trilha de ancestrais não aparece, o header
      não quebra em duas linhas e a página não rola na horizontal.
- [ ] Nenhuma outra tela que usa `PageHeader` muda de aparência.
- [ ] `npm run typecheck` limpo.

## Dados e contratos

Sem mudança de banco, RPC ou tipos. Puramente de UI/navegação. Depende do ADR
0009 (breadcrumb como padrão de navegação de contexto).

## Plano de implementação

1. `PageHeader.tsx`: prop `breadcrumbs`, render condicional na linha do título.
2. `PeriodoPopover.tsx`: extrai a lógica de período/visualização do antigo header.
3. `Financeiro.tsx`: migra para `PageLayout` + `PageHeader`, título/trilha por aba.
4. Remove `financeiro/components/FinanceiroHeader.tsx`.

## Rollout: breadcrumb nas demais telas (2026-07-30)

Além do Financeiro, o padrão foi aplicado onde havia navegação de detalhe ou
subnível. `moduleLabel` passou a `false` por default no `PageHeader` (todas as
telas mostram só o nome da página).

| Tela            | Trilha                         | Observação                                                                                                                  |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/financeiro`   | `Financeiro › [aba]`           | módulo com abas: a aba é o conteúdo                                                                                         |
| `/admin`        | `Admin Portal › [aba]`         | idem; estado já em `?tab=`                                                                                                  |
| `/clientes/:id` | `Clientes › [nome do cliente]` | trilha para na entidade (sem aba interna); "Voltar" removido                                                                |
| `/projetos/:id` | `Projetos › [nome do projeto]` | trilha para na entidade; `ProjetoDetailHeader` virou strip de contexto; header migrado para `PageHeader`; "Voltar" removido |

Convenção: em módulos com abas (Financeiro, Admin) a folha é a aba ativa, porque
não há entidade; em telas de detalhe (Clientes, Projetos) a folha é o nome da
entidade e a trilha NÃO desce até a aba interna (decisão de 2026-07-30: o nível 3
virava ruído). Ancestral raiz navega por rota (`to`).

Fora do rollout: detalhes que abrem em modal (Leads, Equipe, Fornecedores,
Propostas) e o Portal do cliente (shell próprio).
