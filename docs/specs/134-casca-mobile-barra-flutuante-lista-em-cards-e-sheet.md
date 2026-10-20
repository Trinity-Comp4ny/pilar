# SPEC 134: Casca mobile (barra flutuante, lista em cards, formulário em sheet)

**Data:** 2026-10-19
**Status:** Em implementação
**Autor:** Matheus
**Módulo:** transversal (Início, Financeiro, Projetos, Obra, Ultra admin)
**Depende de:** [SPEC 097](./097-navegacao-mobile-bottom-bar-e-chip-nav.md), [ADR 0040](../architecture/adr/0040-navegacao-mobile-bottom-bar-substitui-sidebar.md), [SPEC 127](./127-datatable-estendido-e-migracao-das-listas.md), [ADR 0049](../architecture/adr/0049-movimento-fala-com-a-marca.md)
**Protótipo (aprovado em 19/10):** https://claude.ai/artifact/TQNijhoXhiM1Tdn11gHwwQ (página "Mobile do app")

## Problema

O celular mostra a tela do desktop encolhida. Quem sente é o gestor de escritório que abre o Pilar no
celular para consultar um lançamento, cadastrar uma despesa ou ler um feedback: a tabela rola para o lado, o
modal é um quadrado no meio da tela, o campo de texto dá zoom ao tocar e a barra de baixo parece uma faixa
colada. Em 19/10 o Matheus não conseguiu abrir um feedback no portal do ultra admin pelo celular.

## Objetivo

No celular (menos de 768 px) o app tem casca própria: barra flutuante, lista em cards no lugar de tabela,
formulário em painel que sobe de baixo, ação principal em botão flutuante e transição entre telas. O desktop
não muda.

**Fora de escopo:** cores, tipografia e tokens (o design system fica como está); redesenho de telas densas
(Gantt, DRE, Rentabilidade), que no celular mostram resumo e o aviso "Abrir no computador"; o diário de obra
(SPEC 135).

## Requisitos

1. **Campos sem zoom.** Todo campo de texto (`Input`, `Textarea`, `SelectTrigger`, campos próprios como
   `MoneyInput`) tem fonte de 16 px abaixo de `md`; de `md` para cima nada muda (`text-sm max-md:text-base`).
2. **Modal vira painel de baixo.** Abaixo de `md`, todo `DialogContent` (inclusive o do `FormDialog`) ancora
   embaixo da tela, com cantos superiores arredondados, alça, altura máxima de 92 dvh, rolagem interna,
   respeito à safe area e animação de subir. De `md` para cima continua modal central. `AlertDialog` de
   confirmação continua central.
3. **Rodapé do formulário fixo.** No `FormDialog` mobile, os botões Cancelar e Salvar ficam presos ao fim do
   painel, acima do teclado, e o Salvar é largura total.
4. **Barra de baixo flutuante.** Pílula solta das bordas (16 px laterais, acima da safe area), fundo
   translúcido com blur e sombra suave. Cinco itens: Início, Projetos, Obra, Gestão e Menu. O item ativo tem
   fundo verde da marca com ícone e texto pretos. Agentes sai da barra e passa a viver no Menu (com o contador
   de pendências no ícone do Menu) e num cartão em Início.
5. **Barra some ao rolar.** Rolando para baixo a barra desce e some; rolando para cima, ou no topo, ela volta.
   Com teclado aberto ela não aparece.
6. **Abas e filtros numa linha.** Chips de módulo, abas de seção e filtros ficam numa linha só, com 34 px de
   altura, cantos totalmente arredondados e a mesma borda. O que não cabe rola para o lado, sem quebrar em
   duas linhas.
7. **Ação principal flutuante.** `MobileFab`: botão verde, texto e ícone pretos, 44 px, acima da barra, à
   direita. É montado pelo `PageHeader` no lugar do botão do cabeçalho, então vale para toda página com ação
   principal (Financeiro: Novo lançamento, Projetos: Novo projeto, Obras...). Desce junto com a barra quando
   ela some. O botão do cabeçalho continua no desktop.
8. **Lista em cards.** `DataTable` ganha modo card abaixo de `md`: a coluna marcada `mobile: "title"` é o
   título, `"subtitle"` a linha de apoio, `"badge"` o status e `"trailing"` o valor à direita. Colunas sem
   marca somem do card. Tabela que não declara nenhuma coluna `mobile` mantém o comportamento de hoje.
   Toque na linha abre o detalhe.
9. **Estados da lista.** Carregando mostra o `PageLoader` com o texto do que está vindo ("Buscando lançamentos
   de outubro"), vazio mostra `EmptyState` com ícone de "+" e a primeira ação, erro mostra o que houve e
   "Tentar de novo".
10. **Transição entre telas.** Abaixo de `md`, qualquer troca de rota anima o conteúdo (fade e subida de 8 px,
    240 ms), sem mexer na barra e no cabeçalho. Com movimento reduzido, não anima. É uma exceção mobile à
    regra da ADR 0049 ("trocar de aba no mesmo módulo não anima").
11. **Telas ajustadas:** Financeiro Lançamentos (lista por dia, deslizar a linha revela "Marcar pago"),
    Ultra admin Feedback (cards, chips de filtro numa linha, detalhe em tela cheia) e o Menu (com Agentes).
    Início com cartões de atenção e Projetos com lista em cards ficam para o próximo PR desta spec.
12. **Desktop intocado.** Nenhuma das mudanças acima altera layout, tamanho ou comportamento de `md` para cima.

Requisitos não-funcionais:

- **Acessibilidade:** alvo de toque de 44 px, foco visível, `aria-current` no item ativo, painel com foco preso
  e retorno do foco (já no `useRestaurarFoco`).
- **Performance:** o escutador de rolagem é passivo e só escreve estado quando a direção muda.

## Critérios de aceite

- [ ] Dado o app em 390 px, quando toco em qualquer campo de texto ou seleção, então o navegador não dá zoom
      (fonte computada de 16 px).
- [ ] Dado 390 px, quando abro "Novo lançamento", então o formulário sobe de baixo, o Salvar fica colado ao
      fim do painel e fechar pelo X, pela alça ou arrastando para baixo volta à lista.
- [ ] Dado 1280 px, quando abro o mesmo formulário, então é o modal central de sempre.
- [ ] Dado 390 px, quando rolo a lista para baixo, então a barra some; quando rolo para cima, volta.
- [ ] Dado 390 px em Financeiro, então abas e filtros ocupam uma linha e o último rola para o lado.
- [ ] Dado `DataTable` com colunas `mobile`, quando a largura é 390 px, então renderiza cards e, em 1280 px,
      a tabela.
- [ ] Dado `DataTable` sem coluna `mobile`, então nada muda em nenhuma largura.
- [ ] Dado movimento reduzido ativo, quando troco de tela, então não há animação.
- [ ] Caso de borda: dado Início com 0 pendências de agentes, então o Menu não mostra contador.

## Dados e contratos

Sem banco, sem edge function. Contratos de componente:

- `ColumnDef<T>.mobile?: "title" | "subtitle" | "badge" | "trailing"`.
- `DataTable`: `loadingLabel?: string` (texto do `PageLoader` no estado de carregamento).
- `MobileFab({ label, icon, onClick | to })`.

## Plano de implementação

1. Campos a 16 px (`Textarea`, `SelectTrigger`, demais) e teste de varredura.
2. `DialogContent` como painel de baixo em `max-md`; rodapé fixo no `FormDialog`.
3. `BottomNav` flutuante verde, 5 itens, esconde ao rolar; `MoreSheet` recebe Agentes.
4. `useRouteEnter` com exceção mobile.
5. `MobileFab` e troca nas telas.
6. `DataTable` modo card e `loadingLabel`.
7. Telas: Financeiro Lançamentos (`LancamentosTable` é exceção custom, ganha lista própria), Projetos,
   Ultra admin Feedbacks, Início.
8. Atualizar `docs/design/PILAR_DESIGN_SYSTEM.md` (Modais, Tabela, Navegação) e prints antes e depois no PR.

## Decisões e riscos

- Agentes fora da barra é decisão do protótipo aprovado; se faltar descoberta, a variação de 6 itens existe
  no protótipo.
- Painel de baixo em todo `Dialog` mexe em ~100 modais de uma vez: o risco é um modal com layout que só
  funcionava centralizado. Mitigação: varredura visual em 390 px dos modais mais usados antes do PR.
- Sem ADR novo: não muda a arquitetura de navegação decidida na ADR 0040.
