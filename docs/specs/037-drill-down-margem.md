# Spec 037 — Drill-down da margem do projeto

Status: **implementado** · 2026-08-13 · item #17 do scorecard / #1 de [LEVEL_UP_CONFIANCA_NUMERO](../strategy/LEVEL_UP_CONFIANCA_NUMERO.md).

## Problema

O dono/engenheiro vê o lucro e a margem por projeto no relatório de rentabilidade, mas não consegue ver **as linhas que compõem** o número. Sem rastreabilidade, o número é "planilha bonita", não algo em que ele assina embaixo. É o maior salto de confiança para o ICP (produto de dinheiro).

## Decisão

Clicar numa linha de projeto (Financeiro → Relatórios → aba Rentabilidade, modo "projeto") abre um dialog com quatro blocos: **Receitas**, **Despesas diretas**, **Custo de mão de obra** e **Parcelas de faturamento**. Cada bloco lista as linhas (descrição, data, status, valor) e um subtotal que bate com o total daquela linha da tabela.

Fonte: RPC nova `get_projeto_rentabilidade_detalhe(p_projeto_id)` (migration `20260825000000`), `SECURITY DEFINER` com **guard de empresa explícito** (`get_user_empresa_id()` + verificação de que o projeto é da empresa do caller + `RAISE` se não bater) e `EXECUTE` só para `authenticated` (nunca `anon`) — o padrão de segurança mais estrito do módulo. Os filtros de cada bloco replicam exatamente os de `rpc_dashboard_rentabilidade` para o detalhe fechar com o total.

## Consequências

- **Custo de MO vem vazio** enquanto o Timesheet estiver dormente (sem apontamento de horas). O dialog mostra copy honesta ("Nenhuma hora apontada… o custo de mão de obra depende do apontamento"). É honesto e revela que a MO não é capturada hoje, em vez de fingir que o custo direto é só despesa.
- **Sem recorte de período**: o relatório é acumulado por projeto; o drill-down herda isso.
- A RPC retorna `jsonb`, então não altera o shape de nenhuma tabela em `types.ts`.
- A tela viva é `RelatoriosRentabilidade.tsx`; `Rentabilidade.tsx` e `rentabilidade/index.tsx` estão dormentes (não montadas).

## Riscos

- O detalhe pode não fechar com o total se houver despesa com `is_fatura_payment` e `projeto_id` preenchido (o total do dashboard não exclui esse flag; o detalhe replica o mesmo filtro para manter a igualdade). Regra a revisitar caso apareça duplicação fatura + despesas-filhas.
- `get_user_empresa_id()` é a barreira única de tenant; a RPC dá `RAISE EXCEPTION` se a empresa não resolver, em vez de retornar vazio silencioso.
