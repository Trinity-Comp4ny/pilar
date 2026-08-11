# Spec 024 — Filtros do Financeiro padronizados

Status: Implementado (Fase 1 e 2) — pendente verificação visual no browser e deploy
Depende de: —
Origem: sessão de uso com design partner (11/08/2026) — inconsistência entre os filtros
das abas do Financeiro travou o cliente em três pontos concretos.

## Problema

O Financeiro tem **três padrões de filtro de tempo** convivendo, e nenhum é de fato
compartilhado. Cada aba reinventou o filtro:

| Padrão | Onde | Sintoma |
|---|---|---|
| Range com presets **A** | Header (Visão Geral, Fluxo) — `PeriodoPopover` | Sem "Todo o período"; calendário sempre aberto; navega mês a mês |
| Range com presets **B** | Lançamentos — `LancamentosFilterBar` | Tem "Todo o período", mas `numberOfMonths={2}`, presets com outros nomes, lógica duplicada |
| Mês + Ano (2 selects) | Folha, DRE, WIP | Outra cara, cada um com sua lista de meses/anos |

Os presets são **tipos diferentes** (`PresetKey` em `PeriodoPopover` vs `Periodo` em
`lancamentosFilters.ts`) e a conversão preset→datas está escrita duas vezes
(`rangeForPreset` e `periodoRange`). Faturas filtra por cartão; Contas não tem período.

### Os três incômodos vividos pelo cliente

1. **"Personalizado" com o calendário já aberto.** No `PeriodoPopover` o calendário fica
   sempre visível ao lado dos presets, e clicar em "Personalizado" não faz nada
   (`if (key === "custom") return;`). O cliente clicou esperando abrir algo que já estava
   aberto, e não entendeu.
2. **Navegação mês a mês.** O `Calendar` só usa setas. Voltar anos exige clicar seta a
   seta. O estilo de dropdown de mês/ano existe em `calendar.tsx` mas nenhum filtro liga
   o `captionLayout`.
3. **"Todo o período" inconsistente.** Existe em Lançamentos, não existe no header. Em
   algumas abas o cliente consegue ver "tudo da empresa", em outras não.

## Objetivo

Um só jeito de filtrar tempo no Financeiro, com a mesma cara e o mesmo comportamento em
toda aba. Dois módulos compartilhados (um para intervalo, um para competência), zero
lógica de preset duplicada.

## O que muda

### 1. Fonte única de presets — `src/lib/periodo.ts`

Um módulo com o tipo de preset, os rótulos e a conversão preset→datas, usado por todos os
filtros. Inclui o preset `"tudo"` (Todo o período → `{ from: null, to: null }`) e
`detectPreset(from, to)`.

```
type PeriodoPreset = "mes-atual" | "mes-anterior" | "ultimos-30" | "este-ano" | "tudo" | "custom";
```

Elimina `rangeForPreset` (PeriodoPopover) e `periodoRange` (lancamentosFilters) duplicados.

### 2. `FiltroPeriodo` compartilhado (range) — `src/components/filters/FiltroPeriodo.tsx`

Substitui o `PeriodoPopover` e a seção de período do `LancamentosFilterBar`. Contrato:

```
<FiltroPeriodo
  from={Date | undefined} to={Date | undefined}
  onChange={(from, to) => void}
  presets={PeriodoPreset[]}      // default: todos, incluindo "tudo"
  footer={ReactNode}             // slot p/ o toggle Diário/Mensal da Visão Geral
/>
```

Comportamento (resolve os incômodos 1 e 2):
- **Presets primeiro; calendário revelado só ao escolher "Personalizado".** Ao selecionar
  um preset que não seja "Personalizado", aplica e fecha. Ao escolher "Personalizado", o
  calendário aparece dentro do mesmo popover. Ao reabrir num período custom, já abre no
  calendário.
- **Calendário com dropdown de mês e ano** (`captionLayout="dropdown-buttons"`,
  `fromYear`/`toYear`), para saltar anos sem clicar seta a seta. `numberOfMonths={1}`,
  `locale={ptBR}`, `mode="range"`.
- **"Todo o período"** como preset padrão em toda tela de range.

### 3. `FiltroCompetencia` compartilhado (mês/ano) — `src/components/filters/FiltroCompetencia.tsx`

Um só componente mês+ano, com a mesma cara visual do `FiltroPeriodo`, para as telas cuja
unidade natural é a competência (um mês fechado), não o intervalo:

```
<FiltroCompetencia mes={number} ano={number} onChange={(mes, ano) => void} fromYear? toYear? />
```

Folha de pagamento continua sendo por competência (folha é sempre um mês fechado; forçar
range seria errado), mas fica visualmente idêntica ao resto. DRE e WIP (dormentes) reusam
o mesmo componente.

### 4. "Todo o período" na Visão Geral e Fluxo (camada de dados)

Hoje `useFinanceData` e `useTopTransactions` tratam data indefinida como **mês atual**
(`dateFrom || startOfMonth(now)`). Para "Todo o período" funcionar de verdade:
- Data indefinida passa a significar **sem filtro de data** (all-time), não mês atual.
- `useFinanceData` deriva a janela (buckets do gráfico e comparação com período anterior)
  do **intervalo real dos dados** quando o período é all-time, em vez de iterar
  `start→end` indefinidos. Na Visão Geral com "Todo o período", o agrupamento resolve para
  a granularidade mais grossa (mensal) para não estourar o gráfico.

Como o header do Financeiro **sempre** nasce no mês (`Financeiro.tsx:49-50`), data
indefinida só ocorre quando o usuário escolhe explicitamente "Todo o período" — não há
ambiguidade com o estado inicial.

## Fora de escopo

- Unificar os filtros **não temporais** (categoria, projeto, cliente, status de
  Lançamentos) — já usam `MultiSelectFilter` e ficam como estão.
- Faturas (filtro por cartão) e Contas (sem período) — não ganham filtro de tempo.
- Telas dormentes (DRE, WIP, ResumoMensal, Aging, Rentabilidade) — reusam os componentes
  novos quando forem religadas, sem virar prioridade agora.

## Fases

**Fase 1 (baixo risco, entrega os fixes de UX do cliente):**
- `src/lib/periodo.ts` + testes.
- `FiltroPeriodo` e `FiltroCompetencia`.
- Religar `PeriodoPopover`, `LancamentosFilterBar` (seção período) e `FolhaPagamento`.
- Nesta fase, no header, "Todo o período" fica disponível; a Visão Geral cai para o
  comportamento de janela existente até a Fase 2 (ver critério abaixo).

**Fase 2 (mexe em número de dinheiro, cuidado):**
- `useFinanceData` e `useTopTransactions` suportam all-time com janela derivada dos dados.
- Atualizar `useFinanceData.test.ts`.

## Critérios de aceite

- [ ] Um só componente de range e um só de competência no Financeiro; zero conversão de
      preset duplicada (grep por `rangeForPreset`/`periodoRange` isolados = 0).
- [ ] Clicar "Personalizado" **revela** o calendário; ao entrar sem custom, o calendário
      não aparece.
- [ ] O calendário permite escolher mês e ano por dropdown e saltar anos.
- [ ] "Todo o período" aparece em Visão Geral, Fluxo e Lançamentos e retorna os dados sem
      filtro de data (Fase 2 para Visão/Fluxo).
- [ ] Folha, e as telas dormentes que usam competência, com a mesma cara do resto.
- [ ] `npm run typecheck` e `npm run test:run` verdes.
