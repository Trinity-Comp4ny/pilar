# SPEC: Margem confiável — custo por alocação e confiança declarada

**Data:** 2026-07-27
**Status:** Draft (aguardando decisão do CEO sobre a fonte de custo)
**Autor:** Matheus (com levantamento de dados de produção)
**Módulo:** projetos + financeiro (rentabilidade)

Contexto: [decisão 25/07](../strategy/DECISAO_PILARES_E_AGENTES_2026-07-25.md) (prioridade
P1), [discussão de time 14/07](../strategy/DISCUSSAO_TIME_2026-07-14.md) ("timesheet morto
como gate → custo por alocação"), [BACKLOG](../BACKLOG.md) itens B2 e P1.

## Problema

A tagline do produto é "saiba se cada projeto está dando lucro antes de terminar" e hoje
o Pilar **não sabe**. O diagnóstico anterior dizia "a margem ignora mão de obra"; o
levantamento em produção (27/07) mostrou algo pior e mais simples:

1. **A RPC está quebrada, não imprecisa.** `rpc_dashboard_rentabilidade` e
   `rpc_projeto_rentabilidade` fazem `SELECT SUM(t.horas) FROM timesheets`. Essa tabela
   **não existe** em produção; a real chama-se `timesheet_lancamentos` (a migration
   `20260429000001_drop_timesheets.sql` derrubou a antiga e `20260514200000_timesheet.sql`
   recriou com outro nome; as RPCs ficaram para trás). Resultado: erro em runtime.
2. **Não existe fonte de custo de mão de obra alimentada.** `timesheet_lancamentos` tem
   **0 linhas** e `projeto_orcamento_fases` tem **0 linhas** (logo o `custo_orcado` que a
   RPC calcula é sempre zero).
3. **O cálculo do front ignora mão de obra por construção:**
   `src/hooks/useRentabilidade.ts:42` faz `margemBruta = receitas - despesas_diretas` e
   `custoIndireto = despesas * 15%` (percentual fixo). `horas_consumidas` é carregado e
   nunca multiplicado por nada.
4. **Despesas por projeto são raras:** 16 despesas vinculadas a projeto para **87
   projetos com valor de contrato**. Mesmo com a fórmula certa, a maioria das margens
   seria calculada sobre quase nenhum custo.

### Dados de produção em 2026-07-27 (base da decisão)

| Dado | Quantidade |
|---|---|
| Projetos ativos/concluídos com `valor_contrato > 0` | 87 |
| Projetos com disciplinas | 91 |
| Disciplinas cadastradas (`projeto_disciplinas`) | 209 |
| **Alocações pessoa↔disciplina (`projeto_disciplina_responsaveis`)** | **192** |
| Pessoas com `salario_fixo > 0` | 8 |
| Pessoas com `horas_semanais > 0` | 12 |
| Receitas vinculadas a projeto | 79 |
| Despesas vinculadas a projeto | **16** |
| Horas apontadas (`timesheet_lancamentos`) | **0** |
| Fases de orçamento (`projeto_orcamento_fases`) | **0** |

Leitura: **existe matéria-prima para custo por alocação** (192 vínculos + salário +
horas semanais + prazo da disciplina) e **não existe** para custo por hora apontada.

## Objetivo

Depois desta spec, para cada projeto o Pilar mostra a margem **com o custo de mão de
obra incluído** e **declara a confiança do número**, de forma que o sócio do escritório
possa auditar de onde ele veio. Nenhuma tela exibe "lucro" quando o custo está ausente.

**Fora de escopo:** captura de horas (é o P2, que refina este número depois);
reativar o módulo Timesheet; DRE/WIP/Aging; rateio de custo indireto por centro de custo.

## Decisão pendente (bloqueia o plano)

**Qual é a fonte de custo de mão de obra da v1?**

- **(A) Custo por alocação, estimado** (recomendado): `custo_hora = salario_fixo /
  (horas_semanais * 4,33)`; horas atribuídas por disciplina a partir do prazo
  (`data_inicio` → `data_previsao`) e da carga da pessoa. Funciona **hoje** com os 192
  vínculos existentes. Rótulo obrigatório: "estimado".
- **(B) Só hora apontada:** mais exato, mas depende de um módulo com 0 lançamentos e que
  o ICP relatou ter morrido duas vezes. A margem continuaria indisponível por meses.

## Requisitos

1. **Corrigir as RPCs** (`rpc_dashboard_rentabilidade`, `rpc_projeto_rentabilidade`):
   trocar `timesheets` por `timesheet_lancamentos`, confirmando nomes de coluna
   (`horas`, `status`, `deleted_at`) contra o schema real antes de aplicar.
2. **Somar custo de mão de obra** ao custo do projeto, na fonte escolhida acima, e
   expor os componentes separados: `custo_mao_obra`, `despesas_diretas`,
   `custo_indireto`.
3. **Confiança declarada** por projeto, calculada por regra determinística (nunca LLM):
   - `completa`: tem receita, tem custo de mão de obra e tem despesa lançada
   - `parcial`: falta um dos componentes (diz qual)
   - `indisponível`: sem custo algum → **não exibir percentual de margem**, exibir o
     motivo e a ação ("aloque responsáveis nas disciplinas" / "lance as despesas")
4. **Drill-down**: o número abre e mostra as linhas que o formaram (receitas, despesas,
   alocações com horas e custo/hora), cada uma clicável para o registro.
5. **Custo indireto deixa de ser 15% fixo sobre despesas**: passa a percentual
   configurável por projeto (`projetos.custo_indireto_pct` já existe) aplicado sobre o
   custo total, com o valor default visível na UI.
6. Toda tela que hoje mostra margem (detalhe do projeto, dashboard, relatório de
   rentabilidade) consome a mesma fonte: uma função única, nunca cálculo local.

Não-funcionais: RLS por `empresa_id` mantida nas RPCs (`SECURITY DEFINER` +
`get_user_empresa_id()`, padrão atual); a query de margem não pode fazer full-scan por
projeto na listagem; valores monetários via `lib/format` (ADR 0008).

## Critérios de aceite

- [ ] Dado um projeto com receita, alocações e despesa, quando abro o detalhe, então vejo
      margem com os 3 componentes de custo e a etiqueta "completa".
- [ ] Dado um projeto sem nenhuma alocação e sem despesa, então **não** vejo percentual
      de margem, e sim "margem indisponível" com a ação para resolver.
- [ ] Dado um projeto com alocação mas sem despesa, então vejo margem marcada como
      "parcial" e a lista do que falta.
- [ ] Dado que clico no valor da margem, então vejo as linhas que a formaram e cada uma
      navega para o registro.
- [ ] Dado o estado atual de produção (0 horas, 0 fases), então nenhuma tela quebra e
      nenhuma exibe lucro fictício.
- [ ] Dado o sócio da VRZ conferindo 3 projetos contra a planilha dele, os números batem
      (validação manual documentada no PR — este é o gate real).
- [ ] `npm run test:run` verde com testes da função de margem: completa, parcial,
      indisponível, receita zero, custo maior que receita (margem negativa).

## Dados e contratos

- **Migration**: substituir as 2 RPCs (usar `DROP` + `CREATE` explícito, não
  `CREATE OR REPLACE`, por causa da armadilha de overload registrada na memória do
  projeto). Rodar `npm run gen:types` depois.
- Retorno acrescido de: `custo_mao_obra numeric`, `custo_total numeric`,
  `confianca text` ('completa'|'parcial'|'indisponivel'), `faltas text[]`,
  `fonte_custo text` ('alocacao'|'timesheet'|'nenhuma').
- Front: `useRentabilidade.calcularMargens` deixa de calcular custo e passa a consumir o
  que a RPC entrega (cálculo objetivo no banco, ADR 0008).

## Plano de implementação (a aprovar depois da decisão A/B)

1. Confirmar schema de `timesheet_lancamentos` e `projeto_disciplina_responsaveis` (S)
2. Migration das RPCs: nome correto da tabela + custo por alocação + confiança (M)
3. `gen:types` + adaptar `useRentabilidade` para consumir sem recalcular (S)
4. UI: etiqueta de confiança, estado "indisponível" com ação, drill-down (M)
5. Validação com dados reais da VRZ, lado a lado com a planilha dela (S, mas é o gate)

## Decisões e riscos

- **Risco de número pior que o atual**: incluir mão de obra vai derrubar margens que hoje
  parecem boas. É o objetivo, e precisa de comunicação ao cliente antes de aparecer.
- **Risco da estimativa por alocação**: horas derivadas de prazo são grosseiras; por isso
  o rótulo "estimado" é obrigatório, e a hora apontada (P2) substitui quando existir.
- **Salário só existe para 8 de 12 pessoas**: pessoa sem salário entra como custo zero e
  **tem que aparecer em `faltas`**, senão o número mente de novo.
- Se a decisão for (B), esta spec vira dependente do P2 e a única entrega imediata é
  corrigir a RPC quebrada + exibir "margem indisponível".
