# SPEC 061: KPIs colapsáveis e board com altura previsível em Leads e Projetos

**Data:** 2026-08-25
**Status:** Implementado (staging local); PR pendente
**Autor:** Matheus
**Módulo:** design-system (transversal: leads, projetos)

## Problema

Feedback direto de cliente (VRZ) na tela de Leads: os KPIs e os filtros ocupam
metade da altura da tela, e o Kanban, que é o conteúdo principal, sobra com
pouco espaço e mostra só ~2 cards por coluna antes de precisar rolar. Em tela
maior o ganho é marginal (ele reportou o mesmo problema depois de trocar de
monitor).

Causa raiz, em `src/pages/leads/index.tsx`: os 5 `KPICard` (linha 509,
`grid grid-cols-2 md:grid-cols-5 gap-2 mb-4`) e o bloco de filtros (toggle
Quadro/Lista + 4 `Select` + botão Limpar, linhas 516-613) ficam empilhados
como blocos de altura fixa **acima** do board. O board recebe só o que sobra
via `flex-1 min-h-0` (linha 646) sem nenhuma altura mínima garantida, então
quanto mais alto o cabeçalho, menos linha visível na coluna do Kanban. O
mesmo desenho, quase linha a linha, existe em `src/pages/Projetos.tsx`
(`ProjetosKPIs` + toggle + `KanbanBoard`).

## Validação de mercado

Pesquisado antes de codar (25/08): nenhum player grande (Trello, ClickUp,
HubSpot, Pipedrive, Salesforce, monday.com) mantém um bloco de KPIs
permanentemente grudado acima do board de trabalho. Três padrões se repetem:

1. **Toggle show/hide explícito.** HubSpot tem botão "Show Metrics"/"Hide
   Metrics" acima do board de Deals. É o precedente direto do item 1 abaixo.
2. **Agregado dentro do cabeçalho da própria coluna**, não num bloco
   separado: Salesforce (soma configurável por coluna), Pipedrive (valor por
   estágio), monday.com (soma no rodapé do grupo).
3. **KPI "de verdade" vira tela separada** (Trello/ClickUp Dashboard view),
   não convive com o board — fora de escopo aqui, mas é onde algo mais
   analítico deveria crescer se um dia precisar.

O padrão 2 motivou uma tentativa de somar o valor por coluna no cabeçalho
(além da contagem que já existia). **Revertido após revisão do Matheus**: com
os KPIs mantidos (ele quer "Em atraso" e "Próximas entregas" visíveis, que
não têm equivalente por coluna), o valor por coluna virou duplicação direta
de "Valor no funil"/"Valor pipeline" na faixa de KPIs. A contagem por coluna
(pré-existente, não introduzida por esta spec) ficou como estava.

## Objetivo

Devolver ao board a maior parte da altura da viewport, sem recriar o
problema pra quem quer ver os KPIs. Não muda mecânica de scroll (continua
scroll interno por coluna, sem duplo-scroll de página+coluna) nem os dados
que os KPIs mostram.

**Fora de escopo:**

- Consolidar Leads e Projetos num `<KanbanBoard>` único. É a Fase 4
  pendente da [SPEC 041](./041-adocao-tanstack-table-e-consolidacao-gantt-kanban.md)
  (Leads hoje é board inline com colunas fixas; Projetos usa
  `KanbanBoard`/`KanbanColumn` acoplados a `Projeto`/`ProjetoEtapa`).
  Reescrever o wiring de DnD dos dois é risco alto num board usado ao vivo
  por design partner, e é ortogonal a este problema (altura, não mecânica de
  arrastar). Se a Fase 4 acontecer depois, ela herda o contrato de altura
  definido aqui.
- Migrar `ListaLeads.tsx` (tabela HTML custom) para `DataTable`. Achado à
  parte durante a investigação, registrado como dívida, não é a causa da
  reclamação (o Kanban é) — vira spec própria se for tocar de novo na tela.
- Redesenho visual do `KPICard` (cor, ícone, formato do delta). Só entra
  uma variante de densidade (padding), não uma repintura.
- Financeiro: não tem o padrão "KPIs + toggle Quadro/Lista + board", fica de
  fora.

## Requisitos

1. Os KPIs viram uma faixa colapsável (`Collapsible` do shadcn, já em uso em
   `LancamentoFormDialog.tsx`), com um trigger visível (ex. chevron ao lado
   do título da página ou botão dedicado "Indicadores").
2. O estado (aberto/fechado) persiste por usuário e por tela em
   `localStorage`, seguindo o padrão já usado no projeto (wrapper próprio,
   como em `useRecentItems`/`useCidadesSalvas`, não existe um
   `useLocalStorage` genérico hoje). Chave por tela (`leads`, `projetos`) pra
   não acoplar as duas preferências. Default: aberto na primeira visita.
3. Quando aberta, a faixa usa uma variante compacta do `KPICard` (prop nova,
   ex. `density?: "default" | "compact"`, reduzindo `p-4`→`p-3` e escondendo
   `subtitle` abaixo de `md`), preservando a mesma prop API existente.
4. O toggle Quadro/Lista e a linha de filtros (Origem, Responsável, Previsão,
   Ordenar, Limpar) se fundem numa única barra horizontal, em vez de duas
   linhas empilhadas.
5. Mudança aplicada em **Leads e Projetos**, com o mesmo componente de faixa
   colapsável e o mesmo hook de persistência, para não criar dois
   comportamentos diferentes entre as telas mais parecidas do produto.
6. `docs/design/PILAR_DESIGN_SYSTEM.md` ganha uma entrada descrevendo a faixa
   de KPIs colapsável e a prop `density` do `KPICard` (hoje o doc só cita a
   existência do componente, sem essa variante).
7. ~~Valor somado por coluna no cabeçalho do Kanban.~~ Implementado e
   **revertido** (feedback do Matheus, 25/08): com os KPIs mantidos visíveis
   por escolha do usuário, o valor por coluna duplicava "Valor no
   funil"/"Valor pipeline". A contagem por coluna, que já existia antes desta
   spec, não muda.
8. A área de soltar cards de cada coluna (`Droppable`, Leads e Projetos,
   incluindo "Sem coluna" e o skeleton de loading) troca `bg-muted/30` por
   `bg-muted` (opacidade cheia). Achado ao verificar ao vivo: o token
   `--muted` já é um cinza muito claro (93% de luminosidade); a 30% de
   opacidade sobre fundo branco fica quase invisível, e a altura recuperada
   pelo colapso dos KPIs lia como "espaço em branco desperdiçado" em vez de
   área de trabalho. Não é mudança de cor fora do design system, só de
   opacidade do mesmo token.
9. O trigger "Indicadores" e a linha de controles (toggle Quadro/Lista +
   filtros em Leads; toggle + `SortControl` em Projetos) viram **uma linha
   só**, em vez de duas linhas empilhadas. Achado ao verificar com o Matheus
   (2ª rodada, 25/08): mesmo com os KPIs fechados e o fundo do board correto,
   sobrava espaço alto demais para "pouca coisa" — três blocos curtos
   (trigger, toggle/ordenação, cabeçalho da coluna) cada um pagando a margem
   de `space-y-6` do `PageLayout` (24px) mais a própria margem. Fundir o
   trigger e os controles numa linha remove um bloco inteiro, não só aperta
   margem. `CollapsibleKpiSection` ganhou a prop `controls` pra isso: os
   controles ficam sempre visíveis (não são afetados pelo colapso), só o
   grid de `KPICard`s entra/sai do `CollapsibleContent`.
10. **Cards do Kanban ficam mais enxutos** (3ª rodada, 25/08 — feedback do
    Matheus com print do Trello como referência). `LeadKanbanCard` tinha até
    4 blocos empilhados com `border-t` (header, badges, email/telefone/origem/
    motivo de perda, valor/responsável); reescrito no mesmo padrão que o
    `ProjectCard` já usava: card na face só com nome, empresa, badges, valor e
    responsável (3 linhas apertadas), e um `HoverCard` (abre no hover, mesmo
    padrão do `ProjectCard`) com email, telefone, origem, motivo de perda e o
    detalhe do valor. Não inventa padrão novo — copia o que já funcionava em
    Projetos para Leads. `ProjectCard` só ganhou `space-y-1.5` no lugar de
    `space-y-2` (mesma densidade nas duas telas).
11. A faixa de KPIs aberta ganhou mais respiro em relação à linha de
    controles logo acima (`pt-2` → `pt-4` no `CollapsibleContent`): "colada"
    era o `pt-2` original ser pequeno demais perto de uma linha que já tem
    vários elementos (trigger + toggle + filtros/ordenação).

## Dados e contratos

- Sem migration de banco, sem RPC nova, `gen:types` não muda.
- Sem dependência nova (o `Collapsible` do shadcn já está instalado).
- `KPICardProps` ganha `density?: "default" | "compact"` (opcional,
  default `"default"`, não quebra os outros ~10 consumidores existentes:
  `ProjetosKPIs`, telas de Financeiro, `inicio/index.tsx`, `Relatorios.tsx`,
  `metas/tabs/MetasDashboard.tsx`, `obras/index.tsx`, etc.).

## Critérios de aceite

- [ ] Dado a tela de Leads com a janela redimensionada pra simular notebook
      (ex. 1366×768, a queixa original do cliente), quando os KPIs estão
      fechados, então a coluna "Novo" do Kanban mostra visivelmente mais
      cards sem precisar de scroll interno do que mostra hoje com KPIs
      abertos.
- [ ] Dado que clico pra fechar os KPIs em Leads, quando recarrego a página,
      então continuam fechados (persistência por usuário).
- [ ] Dado o mesmo teste em Projetos, quando alterno o colapso dos KPIs,
      então o comportamento (persistência, densidade, layout da faixa) é
      idêntico ao de Leads.
- [ ] Dado a view Lista de Leads (não-Kanban), quando os KPIs colapsam,
      então a tabela também ganha a altura liberada (ela já herda scroll de
      página, então isso é consequência natural do item 1, não requisito
      separado).
- [ ] Nenhum outro consumidor de `KPICard` muda de aparência (a prop
      `density` é opt-in).
- [x] Verificado ao vivo no Chrome (ambiente local do Matheus, `dev@local.test`):
      abrir/fechar KPIs em Leads e Projetos, sem scroll duplicado
      (página + coluna).
- [x] `npm run build:strict`, `npm run test:run` (704 testes) e `eslint` nos
      arquivos tocados: verdes.

## Plano de implementação

1. `KPICard`: prop `density` (`src/components/KPICard.tsx`). **Feito.**
2. `usePersistedOpen` (`src/hooks/usePersistedOpen.ts`) + `CollapsibleKpiSection`
   (`src/components/CollapsibleKpiSection.tsx`), componente compartilhado
   entre as duas telas (não duplicar o wrapper `Collapsible` + persistência).
   **Feito.**
3. Leads: `LeadsKPIs` envolvida em `CollapsibleKpiSection`, cards em
   `density="compact"`, toggle Quadro/Lista fundido com a linha de filtros
   numa única linha. **Feito.**
4. Projetos: `ProjetosKPIs` envolvida em `CollapsibleKpiSection`, cards em
   `density="compact"`. **Feito.**
5. `docs/design/PILAR_DESIGN_SYSTEM.md` atualizado. **Feito.**
6. Valor somado por coluna: implementado, depois revertido a pedido do
   Matheus (duplicava a faixa de KPIs — req. 7). **Feito (revertido).**
7. `bg-muted/30` → `bg-muted` nas áreas de drop (Leads, Projetos, skeleton) —
   fix de visibilidade descoberto ao verificar ao vivo (req. 8). **Feito.**
8. `CollapsibleKpiSection` ganhou a prop `controls`; trigger "Indicadores" +
   toggle Quadro/Lista + filtros/ordenação viram uma linha só nas duas telas
   (req. 9). **Feito.**
9. Verificado ao vivo no Chrome nas duas telas, KPIs aberto e fechado.
   **Feito.**
10. `npm run build:strict`, `npm run test:run` (704), `eslint`. **Feito.**
