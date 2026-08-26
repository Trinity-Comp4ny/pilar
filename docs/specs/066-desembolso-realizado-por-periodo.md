# SPEC: Desembolso realizado por período (× orçamento total)

**Data:** 2026-08-26
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [016 — Conta da obra](016-conta-da-obra-e-prestacao-de-contas.md), [063 — Curva S da obra](063-curva-s-da-obra.md)

<!-- Origem: docs/strategy/DECISOES.md (Obras é a frente prioritária). Item
OBR-6 do Mapa de Melhorias ("Planejamento físico × desembolso por período").
Escopo revisado ao pesquisar o código: "físico" já tem resposta própria
(Curva S, spec 063); "planejamento por período" com input manual do sócio
esbarra no mesmo problema que outras specs de hoje já encontraram no ICP
("eu não teria tempo pra isso" — memória de sessão). Esta spec entrega o
recorte que sobra sem pedir dado novo ao usuário. -->

## Problema

A obra já tem "quanto orçamos" (`obra_orcamento_etapa`, por etapa) e "quanto
gastamos" (`obra_conta_lancamento`, lançamento a lançamento), mas nada
mostra **o ritmo do gasto no tempo**. Pra saber se o dinheiro está saindo
mais rápido ou mais devagar do que o esperado, hoje é preciso somar os
lançamentos na mão.

## Objetivo

A aba Conta da obra ganha um gráfico: desembolso realizado (despesas),
acumulado mês a mês, com uma linha de referência do orçamento total previsto
(soma de `obra_orcamento_etapa`). Depois desta feature, "estamos gastando no
ritmo certo pra não estourar o orçamento antes da obra acabar" responde
olhando um gráfico, sem somar nada na mão.

**Fora de escopo (decisão, não corte por prazo):**

- **"Planejado por período"** (o sócio dizer quanto pretende gastar em cada
  mês). Exigiria manter um orçamento mês a mês em cima do que já existe por
  etapa — trabalho de digitação recorrente que a spec 062 e a mesa de
  agentes já mostraram que o ICP não tem tempo de manter ("eu não teria
  tempo pra isso"). Sem esse dado, não força a entrada; usa como referência
  só o total previsto (que já existe), não uma curva planejada no tempo.
- **Dimensão "físico" nesta spec.** Já tem resposta própria: Curva S (spec
  063), no mesmo espírito (planejado × realizado acumulado). Duplicar aqui
  seria a mesma informação com outro desenho.
- **Dimensão "comercial"/faturamento nesta spec.** Já tem sua peça (spec
  065, avanço como contexto nos marcos). Misturar as três num gráfico só
  poluiria mais do que ajudaria; ficam três indicadores pequenos e legíveis,
  não um painel denso.
- **Previsto por etapa distribuído no tempo.** A referência aqui é o total
  da obra, não quebrado por etapa nem por mês. Granularidade maior é
  extensão futura, se a demanda real pedir.

## Requisitos

Funcionais:

1. A aba Conta da obra ganha um gráfico de área: eixo X em meses (do mês do
   lançamento mais antigo até o mês atual), eixo Y em R$ acumulado, mostrando
   o total de despesas (`tipo = 'despesa'`) somado até o fim de cada mês.
2. Uma linha de referência horizontal mostra o orçamento total previsto (soma
   de `valor_previsto` de todas as etapas em `obra_orcamento_etapa`).
3. Tooltip por ponto mostra o mês e o valor acumulado.
4. Sem nenhuma despesa lançada, o gráfico não aparece; entra um empty state
   simples ("Lance despesas para ver o desembolso ao longo do tempo").
5. Sem nenhum orçamento previsto cadastrado (`obra_orcamento_etapa` vazia), o
   gráfico aparece só com a linha de desembolso, sem a referência (não
   inventa um total que não existe).

Não-funcionais:

- **Performance:** cálculo client-side sobre dado já buscado pelos hooks
  existentes (`useObraConta`, `useObraOrcamento`); sem query nova.
- **Consistência:** o último ponto da linha de desembolso bate com
  `totalDespesas` já calculado e mostrado em outro KPI da mesma aba.

## Critérios de aceite

- [x] Dadas despesas de R$10k em junho e R$15k em julho, quando abro Conta da
      obra, então o gráfico mostra R$10k acumulado em junho e R$25k em
      julho.
- [x] Dado um orçamento total previsto de R$100k, quando abro a aba, então
      vejo a linha de referência em R$100k.
- [x] Dado nenhum orçamento previsto cadastrado, quando abro a aba, então o
      gráfico mostra só a linha de desembolso, sem quebrar nem inventar
      referência.
- [x] Dada nenhuma despesa lançada, quando abro a aba, então vejo o empty
      state, não um gráfico vazio.
- [x] Dado o último ponto do gráfico, então o valor bate exatamente com o
      KPI "Total de despesas" já mostrado na mesma aba.
- [x] `npm run test:run` e `npm run typecheck` verdes.

## Dados e contratos

Nenhuma tabela nova. Uma função pura em `src/lib/obras.ts`:

```ts
export interface PontoDesembolso {
  mes: string; // "YYYY-MM"
  acumuladoRealizado: number;
}

export function desembolsoAcumuladoPorMes(
  lancamentos: ReadonlyArray<{ tipo: string; valor: number | string; data: string }>
): PontoDesembolso[];
```

Componente `ObraDesembolsoChart.tsx`: usa `useObraConta` + `useObraOrcamento`
(soma `valor_previsto` de todas as etapas pro total previsto), chama
`desembolsoAcumuladoPorMes`, renderiza `AreaChart` (Recharts, mesmo padrão
visual da Curva S: `hsl(var(--chart-danger))` pra desembolso — é dinheiro
saindo — e `ReferenceLine` pro orçamento previsto) ou o empty state.

## Plano de implementação

1. `desembolsoAcumuladoPorMes` em `src/lib/obras.ts` + testes (todos os
   critérios de aceite de cálculo, sem precisar de banco).
2. `ObraDesembolsoChart.tsx`: monta os dados a partir dos hooks já
   existentes, soma o previsto total, renderiza o gráfico ou o empty state.
3. Inserir em `ObraContaTab.tsx`, perto dos KPIs existentes.
4. `npm run typecheck` + `npm run test:run`.
5. Verificar no browser (dev local): obra com despesas em meses diferentes e
   orçamento previsto cadastrado, confirmar o acumulado e a linha de
   referência; obra sem orçamento previsto, confirmar que não quebra.

## Decisões e riscos

- **Decisão:** sem "planejado por período" (ver "Fora de escopo"). O
  orçamento total já cadastrado vira uma referência estática, não uma curva
  — é o dado real que existe, sem forçar digitação nova.
- **Decisão:** três indicadores pequenos e separados (Curva S = físico,
  este = desembolso, avanço nos marcos = comercial) em vez de um painel
  único com as "3 dimensões" do T2B. Mais fácil de entender cada um sozinho,
  e nenhum depende de ciclo (D1) nem de composição por ambiente (D2) — os
  dois já fechados.
- **Risco:** o orçamento previsto (`obra_orcamento_etapa`) pode estar
  desatualizado ou nunca ter sido preenchido — a linha de referência então
  não aparece (requisito 5) em vez de mentir com um valor zerado.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
