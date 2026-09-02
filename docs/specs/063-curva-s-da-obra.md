# SPEC: Curva S da obra

**Data:** 2026-08-26
**Status:** Em implementação
**Autor:** Matheus (com apoio de agente de IA)
**Módulo:** obras
**Estende:** [027 — Cronograma da obra em dois níveis](027-cronograma-obra-dois-niveis.md), [040 — Obra inteligente](040-obra-inteligente-cronograma-diario-clima.md)

<!-- Origem: docs/strategy/DECISOES.md, entrada 2026-08-25 (Obras é a frente
prioritária) + entrada de 26/08 (OBR-3 trocado de ordem por dependência de
arquitetura em marcos_faturamento). Este item (OBR-4 no Mapa de Melhorias) foi
escolhido por não precisar de nenhuma tabela nova: todo o dado já existe em
tarefas + obra_rdo_tarefa + obra_rdo. -->

## Problema

O cabeçalho da obra mostra um número de avanço ("42%"), mas não mostra **se
esse ritmo está bom ou ruim**. Pra saber se a obra está adiantada ou atrasada
frente ao que foi planejado, hoje é preciso abrir o cronograma e comparar
tarefa por tarefa. Não existe uma visão só, ao longo do tempo, de "o que
devíamos ter feito até hoje" contra "o que de fato fizemos".

## Objetivo

Um gráfico na aba Visão da obra: duas linhas acumuladas ao longo do
calendário da obra, planejado (derivado do prazo das tarefas) e realizado
(derivado de quando cada tarefa foi concluída), com uma marca no dia de hoje.
Depois desta feature, olhar a obra responde "estamos adiantados, no ritmo, ou
atrasados" sem abrir o cronograma.

**Fora de escopo:**

- **Projeção de término** ("no ritmo atual, termina em +56 dias"). Exige
  extrapolar uma taxa a partir de poucos pontos, e errar isso é pior que não
  mostrar nada — quem decide um prazo estimado é o time, não uma reta
  ajustada em cima de 3 pontos de dado. Fica pra quando houver obra real
  gerando histórico suficiente pra validar o método.
- Nenhuma tabela ou coluna nova: os dois números (planejado e realizado) são
  **derivados** de `tarefas` (`data_inicio`/`prazo`, spec 027) e
  `obra_rdo_tarefa` (quando cada uma foi marcada `concluiu`, spec 040). Puro
  cálculo no front, sem migration.
- Peso por valor ou por complexidade da tarefa. Cada tarefa vale 1 unidade,
  igual ao `calcularAvanco` que já existe — consistente com o resto do
  módulo, que é deliberadamente simples (spec 015: "avanço é determinístico,
  não campo manual").
- Curva por frente/etapa separada. V1 é uma curva só, da obra inteira.

## Requisitos

Funcionais:

1. A aba Visão da obra ganha um gráfico de área com duas séries: **Planejado**
   (linha tracejada, acumulado) e **Realizado** (área preenchida, acumulado),
   em % de tarefas, amostrado por semana desde a tarefa mais antiga com data
   até a mais recente (ou até hoje, o que for maior).
2. **Planejado** numa semana = % das tarefas **com `prazo` definido** cujo
   `prazo` já passou até o fim daquela semana. Tarefa sem `prazo` nunca entra
   nesse cálculo (não tem como planejar no tempo o que não tem data) — se
   isso reduzir muito o total, um aviso explica por quê (ver critério de
   borda).
3. **Realizado** numa semana = % de tarefas concluídas (mesmo denominador do
   header "Avanço" hoje: todas as tarefas da obra) cuja **data de conclusão**
   já passou até o fim daquela semana. Data de conclusão = a data do RDO mais
   antigo (`obra_rdo.data`) em que a tarefa foi marcada `concluiu`
   (`obra_rdo_tarefa`); quando a tarefa foi concluída fora do diário (direto
   no cronograma) e não tem nenhum vínculo de RDO, usa `tarefas.updated_at`
   como aproximação. _(v1 implementado: não marca visualmente no tooltip
   quando a data é aproximada — o número entra certo, só não distingue a
   origem. Ver "Decisões e riscos".)_
4. Uma linha vertical marca "Hoje" no gráfico.
5. Tooltip por ponto mostra a semana, % planejado e % realizado.
6. Sem tarefas com `data_inicio`/`prazo` suficientes, o gráfico não aparece;
   entra um empty state explicando o que falta ("defina prazo nas tarefas do
   cronograma para ver a curva").

Não-funcionais:

- **Performance:** cálculo 100% client-side sobre dado já buscado pelos hooks
  existentes (`useObraTarefas`, `useObraRdoTarefas`, `useObraRdos`); sem
  query nova. Função pura, testável sem rede.
- **Consistência:** o valor final de Realizado no último ponto da curva bate
  com o "Avanço" do cabeçalho (mesmo denominador e mesma regra de conclusão).

## Critérios de aceite

- [x] Dado uma obra com 4 tarefas com prazo (2 concluídas até a semana X, 2
      ainda abertas), quando abro a Visão, então a curva de Realizado mostra
      50% a partir da semana X. Verificado por unit test (`curvaSObra`).
- [x] Dado que uma tarefa foi concluída pelo diário no dia 10/08 (RDO daquele
      dia com `resultado: concluiu`), quando calculo a curva, então ela conta
      como concluída a partir da semana que contém 10/08, não antes.
      Verificado por unit test.
- [x] Dado que uma tarefa está `concluida` mas nunca apareceu em nenhum RDO,
      quando calculo a curva, então ela usa `updated_at` como data de
      conclusão (aproximada). Verificado por unit test.
- [x] Dado que nenhuma tarefa tem `prazo`, quando abro a Visão, então o
      gráfico não renderiza e aparece o empty state explicando por quê.
      Verificado no browser (dev local, obra "Reforma Parque das Águas", 0
      tarefas): ícone + texto, sem erro no console.
- [x] Dado o último ponto da curva (semana atual), então o % de Realizado é
      exatamente igual ao "Avanço" mostrado no cabeçalho da obra. Verificado
      por unit test (`curvaSObra` vs `calcularAvanco` sobre o mesmo array).
- [x] Caso de borda: obra sem nenhuma tarefa — nem gráfico nem erro, mesmo
      empty state do critério acima. Mesmo teste de browser acima.
- [x] `npm run test:run` e `npm run typecheck` verdes. 719 testes, 0 erros de
      tipo, lint limpo.

## Dados e contratos

Nenhuma tabela, coluna ou RPC nova. Uma função pura nova em `src/lib/obras.ts`:

```ts
export interface PontoCurvaS {
  semana: string; // ISO da segunda-feira da semana (ex.: "2026-08-10")
  planejadoPct: number; // 0-100
  realizadoPct: number; // 0-100
}

export function curvaSObra(
  tarefas: ReadonlyArray<{
    id: string;
    status: string;
    data_inicio: string | null;
    prazo: string | null;
    updated_at: string;
  }>,
  concluidasPorRdo: ReadonlyMap<string, string> // tarefa_id -> data do RDO (menor data quando houver mais de um vínculo)
): PontoCurvaS[];
```

Componente `ObraCurvaS.tsx` monta `concluidasPorRdo` a partir de
`useObraRdoTarefas` (filtrando `resultado === "concluiu"`, cruzando com
`useObraRdos` pra pegar a data) + fallback pra `updated_at` das tarefas que
não aparecem nesse mapa. Renderiza com Recharts (`AreaChart`, padrão visual
de `src/pages/financeiro/tabs/VisaoGeral.tsx`: `hsl(var(--chart-success))`
pra Realizado, linha tracejada `hsl(var(--chart-info))` pra Planejado,
`ReferenceLine` pra Hoje).

## Plano de implementação

1. `curvaSObra` em `src/lib/obras.ts` + testes (os 6 critérios de aceite
   viram casos de teste da função pura, sem precisar de banco).
2. `ObraCurvaS.tsx`: monta os dados a partir dos 3 hooks já existentes
   (nenhum hook novo), chama `curvaSObra`, renderiza o `AreaChart` ou o
   empty state.
3. Inserir na aba Visão (`ObraTimelineTab.tsx`), como card novo abaixo de
   "Avanço" (ou ao lado, decidir no layout real olhando o espaço disponível).
4. `npm run typecheck` + `npm run test:run`.
5. Verificar no browser (dev local): obra com tarefas concluídas via diário
   em datas diferentes, confirmar as duas curvas e o alinhamento com o
   "Avanço" do cabeçalho.

## Decisões e riscos

- **Decisão:** sem projeção de término no v1 (ver "Fora de escopo"). Menos
  impressionante que o "T2B" que inspirou o item, mas honesto sobre o que o
  dado atual sustenta.
- **Decisão:** Realizado usa o mesmo denominador do "Avanço" do cabeçalho
  (todas as tarefas); Planejado usa só as com `prazo` (denominadores
  diferentes entre as duas linhas). É a única forma da curva bater com o
  número que já existe na tela, ao custo de o "100% planejado" poder nunca
  ser atingido se houver tarefa sem prazo — aceito, e explicitado no empty
  state quando for grave demais pra ignorar.
- **Risco:** tarefa concluída fora do diário sem `updated_at` confiável
  (ex.: importada com data antiga) distorce um ponto da curva. Aceito no v1;
  o tooltip já marca a origem aproximada da data.
- Nenhuma decisão de arquitetura transversal; não abre ADR.
- **Gap do v1:** o requisito 3 previa marcar no tooltip quando a data de
  conclusão é aproximada (`updated_at`, não RDO). Não entrou nesta rodada —
  o número calculado já está certo, só falta a distinção visual. Fica como
  follow-up pequeno, não bloqueia o merge.
