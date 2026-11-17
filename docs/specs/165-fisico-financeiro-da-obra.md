# SPEC: Físico-financeiro da obra (desembolso planejado por mês)

**Data:** 2026-11-16  
**Status:** Em implementação  
**Autor:** Matheus Rezende  
**Módulo:** obras (aba Financeiro)

> Origem: análise de UI das telas de Obras contra Mais Controle e Vobi
> ([ANALISE_UI_OBRAS_2026-11.md](../strategy/ANALISE_UI_OBRAS_2026-11.md), melhoria nº 1). O Mais Controle vende o
> "Cronograma Físico-Financeiro" como tela própria; a Vobi publica "relatório físico-financeiro automático".
> Esta spec cobre só o físico-financeiro. A Curva S ponderada por valor e o cabeçalho executivo da obra ficam em
> specs separadas (ver Fora de escopo).

## Problema

O escritório sabe quanto a obra vai custar (previsto por fase, etapa e serviço) e sabe quando cada etapa acontece
(datas do cronograma), mas não vê **quanto vai precisar desembolsar em cada mês**. O gráfico "Desembolso realizado"
mostra só o que já foi gasto e uma linha reta com o orçamento total, então o sócio não consegue responder "estou
gastando no ritmo planejado?" nem montar o fluxo de caixa da obra para o cliente ou para a financiadora. Sente a dor
o sócio de escritório que administra a obra do cliente (modelo por administração, ADR 0013), antes de pedir aporte.

## Objetivo

A partir de um previsto e de um cronograma já preenchidos, o usuário abre **Financeiro › Físico-financeiro** e vê, sem
digitar nada, a grade de desembolso previsto por mês, a curva planejada acumulada contra o realizado, e exporta o
resultado em Excel ou PDF.

**Fora de escopo:**

- Curva S ponderada por valor e linha "medido/pago" (spec própria; usa o mesmo cálculo de peso, não esta grade).
- Cabeçalho executivo (prazo, desvio, projeção do custo final).
- Linha de base e histórico de versões do planejamento.
- Reajuste por índice (INCC) e antecipação.
- Orçamento analítico com composição e BDI (decisão de ICP, ver ANALISE_COMPETITIVA_2026-11.md).
- Edição em massa por colar planilha.
- Vista do cliente no portal (fase 2, depois da exportação validada com o design partner).

## Requisitos

### Cálculo

1. O sistema calcula o desembolso previsto por mês para cada nó da árvore (`obra_frente`: fase, etapa, serviço) a
   partir de dois dados que já existem: o **previsto** do nó (`obra_orcamento_etapa.valor_previsto`) e o **período**
   do nó (união do período próprio, dos filhos e das tarefas, já montada em `montarArvoreCronograma`).
2. A distribuição padrão é **linear por dia corrido** entre o início e o fim do período. O valor de um mês é
   `previsto × dias do período que caem no mês ÷ dias totais do período`. Um período de um dia só cai inteiro no mês dele.
3. Regra do previsto igual à da árvore atual (`montarOrcadoRealizado`): o nó usa o **próprio** previsto quando é
   maior que zero; senão, a **soma dos filhos**. Quando o nó pai tem previsto próprio, a distribuição dele usa o
   período do pai e as linhas dos filhos aparecem como detalhe que não soma de novo.
4. Nó com previsto e **sem período** não entra nas colunas de mês: o valor vai para a coluna **"Sem data"** e o
   topo da grade mostra o aviso "R$ X em N itens sem data no cronograma", com atalho para o cronograma.
5. O eixo de meses vai do mês do menor início ao mês do maior fim entre os nós com valor, no mínimo 1 coluna e no
   máximo 60. Acima disso, a grade pede para trocar a escala para trimestral (ver requisito 14).
6. O total de cada linha é igual ao previsto dela; o total de cada coluna é a soma das linhas-folha. O **acumulado**
   do último mês é igual ao total previsto da obra (tolerância de R$ 0,01 por arredondamento, resíduo no último mês).

### Edição manual

7. Quem pode editar a obra (`canEdit`) edita o **percentual** de qualquer célula de um nó. Ao editar, o nó passa a
   ser **manual**: todas as células do nó são gravadas e deixam de acompanhar o cronograma.
8. A soma dos percentuais de um nó manual deve fechar 100%. Enquanto não fecha, a linha mostra "faltam X%" ou
   "passou X%" em vermelho e o total da obra mostra a diferença em R$. Não bloqueia o salvamento: o dado real
   costuma estar incompleto.
9. Ação "Voltar ao automático" na linha apaga as células gravadas do nó e volta à distribuição linear.
10. Mudar o previsto ou o período de um nó **manual** não redistribui: mostra o aviso "o planejamento deste item é
    manual e não acompanha as datas" com o botão "Redistribuir".

### Telas

11. Nova visão **Físico-financeiro** dentro da aba Financeiro da obra (alternador no topo da aba, ao lado de
    "Conta"), visível a quem tem `obras_conta view` e `financeiro` (mesma regra do orçado x realizado no cronograma).
12. **Grade:** linhas = a árvore do orçado x realizado (recolher e expandir, cor lateral por nível); colunas =
    meses (`mmm/aa`), mais "Sem data" quando houver; célula em duas linhas, **% em cima e R$ embaixo** (padrão do
    Mais Controle); células vazias em cinza; célula editada à mão com marca visível; rodapé **Acumulado** (R$ e % da
    obra por mês). Primeira coluna fixa no scroll horizontal.
13. **Gráfico "Planejado × realizado":** a linha de orçamento reta do `ObraDesembolsoChart` é substituída por uma
    **linha planejada acumulada**; o realizado acumulado continua como área. Tooltip com o mês, o acumulado
    planejado, o acumulado realizado e a diferença em R$ e em %. Marca "Hoje" no mês atual.
14. Seletor de escala **Mensal | Trimestral**; padrão mensal. Trimestral soma as colunas, sem mudar o dado.
15. No celular (< 768 px) a grade vira lista por mês: um cartão por mês com o total do mês, o acumulado e as
    linhas de fase com seu valor; abrir o cartão mostra as etapas. Edição de célula só no desktop nesta fase.

### Exportação

16. Botões **Exportar Excel** e **Exportar PDF** no topo da visão, com seletor de nível: **Fases**, **Fases e
    etapas** ou **Tudo (até serviço)**. Implementado em `exportarFisicoFinanceiro.ts` (o `relatorioExport.ts` é amarrado a `ReportRow`, não serve de base): Excel com célula numérica e PDF paisagem com quebra de colunas. O PDF leva obra, nível e data; o cliente ficou de fora.
17. O arquivo traz: nome da obra, cliente, data de geração, período, a grade no nível escolhido, a linha
    "Acumulado" e o total. Valores numéricos no Excel (não texto), formato de moeda pt-BR.

### Estados

18. **Sem previsto em nenhum nó:** estado vazio "Preencha o orçado para planejar o desembolso", com os botões
    existentes "Orçado pela estimativa" e o link para a árvore.
19. **Sem datas em nenhum nó:** estado vazio "Defina datas no cronograma para distribuir o desembolso", com link
    para a aba Cronograma.
20. Carregando: `PageLoader` (ADR 0049). Erro: `errorState` padrão com tentar de novo.

### Requisitos não funcionais

- **Segurança / RLS:** a tabela nova segue o padrão de `obra_orcamento_etapa` e `obra_frente`: `empresa_id =
  get_user_empresa_id()` em select, insert, update e delete, com revalidação de que `obra_id` e `obra_frente_id`
  pertencem à mesma empresa. Teste com `auth.uid()` de outra empresa deve falhar.
- **Performance:** o cálculo é no cliente, sobre dados já carregados (nós, previstos, tarefas). Obra com 500 nós e 36
  meses calcula em menos de 100 ms; a grade usa recolhimento para renderizar só as linhas visíveis.
- **Multi-tenant:** isolamento por `empresa_id`, índice por `obra_id`.
- **Permissão de ver dinheiro:** quem não vê o financeiro não vê a visão nem o botão de exportar.

## Critérios de aceite

- [ ] Dado um serviço com previsto R$ 30.000, de 15/11 a 15/12, quando abro a grade, então novembro mostra 51,6% e R$ 15.483,87 (16 de 31 dias corridos) e dezembro 48,4% e R$ 14.516,13; a soma fecha R$ 30.000,00.
- [ ] Dado uma etapa sem previsto próprio e dois serviços com R$ 10.000 e R$ 20.000, então a etapa mostra R$ 30.000 e cada mês da etapa é a soma dos serviços.
- [ ] Dado um pai com previsto próprio R$ 100.000 e filhos com R$ 40.000 e R$ 50.000, então o total da obra conta R$ 100.000 (mesma regra de `montarOrcadoRealizado`) e os filhos aparecem sem somar de novo.
- [ ] Dado um serviço com previsto e sem datas, então ele não entra em nenhum mês, aparece em "Sem data" e o aviso do topo cita o valor e a quantidade.
- [ ] Dado que edito a célula de dezembro de um serviço para 70% (novembro estava 50%), então a linha passa a manual, mostra "passou 20%" e o total da obra reflete a diferença; ao clicar "Voltar ao automático" a linha volta a 50/50.
- [ ] Dado um nó manual, quando mudo a data final dele no cronograma, então a grade não muda e mostra o aviso com "Redistribuir"; ao clicar, recalcula linear e apaga as células gravadas.
- [ ] Dado a escala trimestral, então os totais de trimestre iguais à soma dos meses e o acumulado final não muda.
- [ ] O acumulado do último mês é igual ao total previsto da obra com tolerância de R$ 0,01.
- [ ] O gráfico mostra a linha planejada acumulada e a área realizada; no mês atual o tooltip traz a diferença em R$ e em %.
- [x] Exportar Excel no nível "Fases" gera uma linha por fase, uma coluna por mês e a linha Acumulado; valores abrem como número no Excel.
- [ ] Exportar PDF no nível "Tudo" inclui nome da obra, cliente e data.
- [ ] Usuário sem `financeiro` não vê a visão nem os botões de exportar.
- [ ] Usuário de outra empresa não lê nem grava células de planejamento (teste de RLS).
- [ ] Borda: previsto zero em todos os nós mostra o estado vazio com os botões de preencher o orçado.
- [ ] Borda: período que cruza ano (nov/26 a fev/27) mostra os quatro meses na ordem certa.
- [ ] Borda: nó com início depois do fim não quebra a grade: trata como período inválido, valor vai para "Sem data" com o motivo no tooltip.
- [ ] Borda: obra com mais de 60 meses pede escala trimestral em vez de renderizar 60+ colunas.
- [ ] Borda: fuso horário. Datas são `date` sem hora; o cálculo usa a data local sem converter por UTC (mesmo cuidado de `cronograma.ts`).

## Dados e contratos

### Nova tabela (migration `20261229...`)

```sql
CREATE TABLE public.obra_planejamento_mes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id        uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  obra_frente_id uuid NOT NULL REFERENCES public.obra_frente(id) ON DELETE CASCADE,
  mes            date NOT NULL CHECK (extract(day from mes) = 1),  -- sempre o dia 1
  percentual     numeric(7,4) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, obra_frente_id, mes)
);
CREATE INDEX idx_obra_plan_mes_obra ON public.obra_planejamento_mes (obra_id);
```

- RLS ligada; 4 policies (select, insert, update, delete) com o padrão de `obra_conta_lanc_*` (empresa +
  revalidação de `obra_id` e `obra_frente_id`). Trigger `tg_pilar_touch_updated_at`.
- Só guarda **percentual**, não valor: se o previsto mudar, o valor se recalcula e o planejamento manual continua
  sendo "X% neste mês". Guardar o percentual evita ter de reescrever células quando o orçamento é ajustado.
- Um nó é manual **se e só se** tem pelo menos uma linha nesta tabela. Sem coluna de flag, sem estado duplicado.
- Rodar `npm run gen:types:local` e commitar o `types.ts` (job `types-sync` reprova se esquecer).

### Funções puras novas (sem banco, testáveis)

Em `src/pages/obras/lib/fisicoFinanceiro.ts`:

```ts
distribuirLinear(previsto: number, inicio: string, fim: string): Record<string /* 'YYYY-MM' */, number>
// fecha em previsto exato; resíduo de arredondamento vai ao último mês

montarFisicoFinanceiro(
  arvore: LinhaOrcado[],                       // já montada por montarOrcadoRealizado
  periodoPorNo: ReadonlyMap<string, Periodo | null>,
  manual: ReadonlyMap<string, Record<string, number>>, // nó -> { 'YYYY-MM': percentual }
): {
  meses: string[];                              // eixo
  linhas: LinhaFF[];                            // por nó: { no, nivel, profundidade, previsto, porMes, semData, manual, faltaPct }
  totalPorMes: Record<string, number>;
  acumuladoPorMes: Record<string, number>;
  semData: { valor: number; itens: number };
}

curvaPlanejada(ff, lancamentos): { mes: string; planejadoAcum: number; realizadoAcum: number }[]
```

`curvaPlanejada` reaproveita `desembolsoAcumuladoPorMes` (`src/lib/obras.ts`) para o realizado e alinha o eixo.

### Hooks

- `useObraPlanejamentoMes(obraId)`: lê todas as linhas da obra (uma query).
- `useSalvarPlanejamentoNo(obraId)`: **upsert em lote** das células de um nó (todas de uma vez, para o nó nunca ficar
  meio manual); `useVoltarAutomatico(obraId, frenteId)`: delete por `obra_id + obra_frente_id`.
- Ambos invalidam `["obra_planejamento_mes", obraId]`.

### Componentes

- `ObraFisicoFinanceiro.tsx` (visão), `FisicoFinanceiroGrade.tsx`, `FisicoFinanceiroCelula.tsx` (duas linhas,
  edição inline com `MoneyInput`-like de percentual), `FisicoFinanceiroMobile.tsx`, `exportarFisicoFinanceiro.ts`.
- Reaproveita: `ViewSwitcher`, `EmptyState`, `PageLoader`, `useMoneyMask`, tokens de cor semântica
  (`--chart-*`), `NIVEL_COR` de `cronograma/estado.ts`. Sem cor crua, sem `Loader2` (ADR 0049).
- `ObraContaTab` ganha o alternador **Conta | Físico-financeiro**; o gráfico é um componente novo, `FisicoFinanceiroChart`
  (planejado × realizado); `ObraDesembolsoChart` fica como está na visão Conta, com a linha reta do orçamento.

## Plano de implementação

Preenchido com o agente em plan mode e aprovado antes de gerar código. Ordem proposta, cada passo verificável:

1. **Cálculo puro + testes** (`fisicoFinanceiro.ts`, `.test.ts`): linear, resíduo, soma de filhos, pai com próprio,
   sem data, ano virado, início > fim. Verifica: todos os critérios de cálculo passam sem tocar em UI.
2. **Migration + RLS + tipos** (`obra_planejamento_mes`), `gen:types:local`. Verifica: teste de RLS com duas empresas.
3. **Hooks** de leitura e escrita em lote. Verifica: teste de hook com cliente mockado.
4. **Grade desktop** (leitura, sem edição): aparece no alternador, com estados vazios e aviso de "Sem data".
5. **Gráfico planejado x realizado**: prop `planejado` no `ObraDesembolsoChart`.
6. **Edição de célula** + "Voltar ao automático" + aviso de nó manual. Verifica: critérios de edição.
7. **Exportar Excel e PDF** com os 3 níveis.
8. **Lista no celular** (leitura).
9. **Telemetria** de uso (`abriu_fisico_financeiro`, `exportou_fisico_financeiro`, `editou_celula`) para decidir a fase 2.
10. Atualizar `docs/specs/README.md`, CLAUDE.md não precisa mudar.

Mudança visual: o PR leva o **antes e depois** na mesma imagem, 1440 px e 390 px (regra do dono), com dado seed.

## Decisões e riscos

- **Distribuição linear por dia, não por avanço físico.** Simples, previsível e igual ao padrão do Mais Controle
  ("distribui pela duração de cada etapa"). Curva em S (mais gasto no meio) fica para depois, se o design partner
  pedir; o desenho com percentual por célula já permite.
- **Guardar percentual e não valor.** Evita reescrever o planejamento quando o orçamento muda; custa uma conta a
  mais na leitura.
- **Sem flag de "manual".** Presença de linhas define; evita estado inconsistente entre flag e células.
- **Risco: pai com previsto próprio e filhos com previsto próprio.** É a regra atual da árvore e pode confundir na
  grade. Mitigação: filhos em cinza com o texto "detalhe, não soma" e teste dedicado.
- **Risco: dado de datas incompleto.** Se a maioria dos nós não tem data, a grade fica quase toda em "Sem data".
  Mitigação: o aviso vem com o atalho para o cronograma e a telemetria conta quantos usuários caem nesse estado.
- **Risco: "pago" vs "realizado".** A conta da obra registra despesa lançada, não necessariamente paga. Esta spec usa
  "realizado" (despesas lançadas), como o resto da aba. Uma terceira linha "pago" depende de status de pagamento no
  lançamento e fica para a spec da Curva S.
- **Pergunta aberta para o design partner:** o PDF de financiadora precisa de assinatura, logo ou formato de
  banco específico? Validar com um arquivo real antes do passo 7.
- **Sem ADR:** nenhuma decisão de arquitetura nova; segue o padrão de tabela por obra com RLS por empresa.
