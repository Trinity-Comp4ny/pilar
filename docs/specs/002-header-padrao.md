# SPEC: Header fino padrão por página (search + ações)

**Data:** 2026-07-25
**Status:** Em implementação (aprovada 2026-07-25; PR aberto)
**Autor:** Matheus (padrão extraído de labrynth-ai/labrynth-platform, `frontend/src/components/AppShell.tsx` + `.module.css`)
**Módulo:** shell / UI compartilhada (transversal)

Sucede a spec `001-shell-3-pilares.md` (shell com switcher entregue no PR #138).

## Problema

Cada página do Pilar monta o próprio topo: o `PageHeader` atual é alto (título
`text-2xl/3xl` + descrição), as ações ficam em posições diferentes por página, e a
busca, quando existe, vive em toolbars ad hoc no corpo. O usuário reaprende o topo em
cada tela e o título gigante rouba altura útil de tabelas e kanbans, que são o
conteúdo real do ICP.

## Objetivo

Um header fino, único e previsível em todas as páginas de lista/gestão: título
compacto à esquerda, busca no meio, "+ Adicionar" à direita, sempre nos mesmos
lugares. Depois dele, o usuário sabe operar qualquer página nova sem pensar.

**Fora de escopo:** busca global/⌘K entre entidades (fase 2, abre spec própria quando
o hero do Início provar demanda); mudanças na sidebar (spec 001); redesign dos
conteúdos das páginas; header do portal do cliente.

## Referência: o que roubar do labrynth-platform

Padrões verificados em `AppShell.tsx`/`AppShell.module.css` que entram aqui:

1. **Linha única, sticky, altura fixa** (`--header-h`, `position: sticky; top: 0`),
   full-width, com paddings fluidos (`clamp`). O `PageLayout` do Pilar já tem o slot
   sticky (`src/components/PageLayout.tsx:20`), então isso é ajuste, não estrutura.
2. **Rótulo de contexto em uppercase** pequeno separado por borda (`.module`):
   no Pilar vira o nome do MÓDULO ativo (Gestão/Projetos) ao lado do título da
   página, ligando o header ao switcher da spec 001.
3. **Acessibilidade que já está pronta lá e o Pilar não tem:**
   `aria-current="page"` em navegação, foco movido para o conteúdo em troca de rota
   - `aria-live` anunciando a seção, menu de conta com padrão ARIA completo
     (primeiro item focado, setas ciclam, Esc devolve o foco). Adotar os dois
     primeiros; o menu de conta do Pilar já usa Radix (ok).
4. **Modo app vs modo página** (`appMode`): seções full-height (chat/agentes) não
   ganham este header; páginas de lista sim. Mesmo critério no Pilar: `/agentes` e
   `/inicio` ficam fora.

O que NÃO copiar: as abas de seção no header (no Pilar a navegação é a sidebar) e o
header escuro (`--header-bg`): o Pilar é paper claro, o header segue `bg-white` com
`border-b`.

## Anatomia proposta

```
┌──────────────────────────────────────────────────────────────────────┐
│ [☰] Projetos            [🔍 Buscar projetos…      ]  [⋯] [+ Novo projeto] │  h-14
└──────────────────────────────────────────────────────────────────────┘
  │      │                    │                   │        │
  │      │                    │                   │        └ ação primária: bg-brand text-ink,
  │      │                    │                   │          rounded-full, verbo de ação
  │      │                    │                   └ ações secundárias (export, filtros) ou menu ⋯
  │      │                    └ busca: controlada pela página (liga no filtro
  │      │                      que a página JÁ tem), rounded-full, w-64,
  │      │                      atalho "/" foca
  │      └ título da página: text-base font-medium (era text-2xl/3xl), só o nome
  │        da página (sem rótulo de módulo; subnível vai no breadcrumb, spec 006)
  └ SidebarTrigger só no mobile (comportamento atual do PageHeader)
```

Altura alvo: **h-14 (56px)** no desktop, conteúdo verticalmente centrado. A descrição
longa do PageHeader atual morre; quando indispensável, vira `title` attr ou linha
auxiliar da própria página.

## Requisitos

Funcionais:

1. Evoluir `src/components/PageHeader.tsx` mantendo a API atual (`title`,
   `children?`) e adicionando props opcionais:
   `search?: { value: string; onChange: (v: string) => void; placeholder?: string }`,
   `primaryAction?: { label: string; onClick: () => void; icon?: LucideIcon; feature?: Feature }`,
   `breadcrumbs?: Array<{ label; to?; onClick? }>` (trilha de ancestrais, ver ADR 0009).
   Páginas não migradas continuam renderizando sem quebrar (título encolhe, resto igual).
2. A busca do header é **controlada pela página**: cada página liga `search` no
   estado de filtro que já possui (ex.: filtro de texto de Projetos/Clientes/Leads).
   O header não implementa busca própria nem debounce (a página decide).
3. Tecla `/` foca a busca quando o header tem `search` (ignorada se um input já tem
   foco). Esc limpa e desfoca.
4. `primaryAction` respeita permissão: se `feature` for passada, usa
   `usePermissions().getButtonProps(feature, "edit")` (disabled + tooltip padrão).
5. O header é **título-só**: não há subtítulo/descrição. Contexto que a página
   precise dar vai no corpo dela, não no header.
6. Ações secundárias continuam via `children`, alinhadas à direita antes da primária.
7. Migrar nesta spec as 6 páginas de maior tráfego: **Projetos, Clientes, Leads,
   Documentos (propostas), Fornecedores, Equipe (pessoas)**, ligando busca e "+" nos
   handlers que já existem em cada uma. As demais (Dashboard, Relatórios, admin etc.)
   ficam com o header novo sem search/primary até migração oportunista.
8. Troca de rota move o foco para o `main` e anuncia o título via `aria-live`
   (padrão labrynth), implementado UMA vez no `PageLayout`, não por página.

Não-funcionais:

- **Sem regressão de permissão:** o header não decide acesso; botões usam os gates
  existentes (`getButtonProps`).
- **Mobile:** título + trigger na linha 1; busca colapsa em ícone que expande, ações
  viram menu ⋯ quando não couberem. Nada de segunda linha permanente.
- **Marca:** primária sempre `bg-brand text-ink` (regra de contraste da marca);
  nunca texto verde sobre fundo claro.
- **A11y:** busca com `aria-label`; `aria-keyshortcuts="/"`; foco visível.

## Critérios de aceite

- [ ] Dado qualquer página migrada, o header tem 56px de altura, título à esquerda,
      busca ao centro-direita e "+" primário à direita.
- [ ] Dado `/projetos` com o filtro de texto preenchido pelo header, então a lista
      filtra igual ao input antigo da página (mesmo estado, mesmo resultado).
- [ ] Dado usuário viewer (sem edit em `projetos`), o botão "+ Novo projeto" aparece
      desabilitado com o tooltip padrão de permissão.
- [ ] Dado foco fora de inputs, pressionar `/` foca a busca; Esc limpa e desfoca.
- [ ] Dado navegação de `/clientes` para `/leads`, o foco vai para o conteúdo e o
      título é anunciado (aria-live), sem remontar a sidebar.
- [ ] Dado viewport 375px, header ocupa 1 linha; busca expande por ícone; nenhuma
      ação some sem estar acessível no menu ⋯.
- [ ] Páginas NÃO migradas (ex.: Dashboard) renderizam com o PageHeader novo sem
      erro e sem search.
- [ ] `npm run test:run` e `typecheck` verdes; teste do componente cobrindo: render
      sem props novas, busca controlada, atalho `/`, primária gated.

## Dados e contratos

Sem migration, sem tabela, sem RPC. Contrato do componente:

```ts
type PageHeaderProps = {
  title: string;
  children?: React.ReactNode; // ações secundárias (compat)
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  primaryAction?: { label: string; onClick: () => void; icon?: LucideIcon; feature?: Feature };
  breadcrumbs?: Array<{ label: string; to?: string; onClick?: () => void }>; // ADR 0009
};
```

## Plano de implementação (aprovar antes de codar)

1. Redesenhar `PageHeader` (novo layout + props novas + atalho `/`) + testes (M).
2. Foco/anúncio de rota no `PageLayout` (S).
3. Migrar Projetos e Clientes (ligar busca/+ nos estados existentes) e validar o
   padrão (S-M).
4. Migrar Leads, Documentos, Fornecedores, Equipe (S-M).
5. QA visual desktop/mobile + viewer/editor (S).

Estimativa: 2 a 3 dias efetivos.

## Decisões e riscos

- **Decisão:** evoluir o `PageHeader` existente em vez de criar componente paralelo:
  12+ páginas ganham o visual novo de graça e não nasce dívida de dois headers.
- **Risco:** páginas com toolbars de filtro complexas (Financeiro) têm mais de um
  campo de busca; nesta spec o Financeiro NÃO migra a busca (só o visual), e a
  unificação da toolbar dele fica para depois.
- **Risco:** o atalho `/` pode colidir com inputs de valores; mitigado ignorando o
  atalho quando `document.activeElement` é input/textarea/contenteditable.
- **Revisado (2026-07-30):** o rótulo do módulo ao lado do título virou ruído
  (redundante com o título e com a sidebar). Primeiro `moduleLabel` passou a `false`
  por padrão; depois o prop foi **removido de vez** para o header ser à prova de
  regressão: todas as páginas mostram só o nome da página, sempre no mesmo tamanho e
  peso (`text-base font-medium`). O `MetasHeader` (título `text-2xl/3xl` próprio) foi
  aposentado e Metas passou a usar o `PageHeader`. Contexto de subnível agora é papel
  do breadcrumb (spec 006 / ADR 0009).
