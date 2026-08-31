# SPEC: Motor de tokens, fundação: ledger, saldo e débito (shadow mode)

**Data:** 2026-08-31
**Status:** Em implementação
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Fases 0 e 1 de [MOTOR_DE_TOKENS.md](../strategy/MOTOR_DE_TOKENS.md).
> Arquitetura: [ADR 0035](../architecture/adr/0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md).
> Decisão de produto que funda tudo: DECISOES.md 2026-08-31 (token é a unidade exposta).

## Problema

O Pilar vai incluir cota de tokens nos planos e vender pacote avulso, mas hoje não existe
contabilidade confiável: o uso de IA está espalhado em três estruturas que não se falam
(`ai_usage_logs` sem usuário, `ai_usage` com contador que já falhou em silêncio,
`agent_runs` só nos fluxos agênticos). Sem fonte única com atribuição completa e saldo,
qualquer número de cota ou preço é chute e qualquer cobrança é indefensável numa disputa.

## Objetivo

Toda chamada de LLM em produção vira uma linha imutável num ledger único, atribuída a
empresa, usuário e agente, com custo estimado; o saldo por empresa existe e bate com o
ledger; tudo em **shadow mode** (mede, não bloqueia ninguém). Depois desta spec é possível
responder com dado real: quanto cada empresa/usuário/agente consome, e quanto custa.

**Fora de escopo:** enforcement de cota (Fase 2), compra de pacote via Asaas (Fase 3),
qualquer UI de cliente ou de ultra-admin (Fases 4 e 5), números finais de cota/preço
(Fase 6), reativação de agentes dormentes do IA Hub.

## Requisitos

Funcionais:

1. Existe a tabela `ai_token_ledger` (append-only) conforme ADR 0035, com RLS: SELECT para
   membros da própria empresa; INSERT/UPDATE/DELETE negados a `authenticated` (escrita só
   por `service_role` via RPC).
2. Existe `ai_token_saldo` (uma linha por empresa, `saldo_plano` + `saldo_comprado`),
   atualizada exclusivamente por trigger `AFTER INSERT` do ledger, com débito em cascata:
   `usage` consome `saldo_plano` até zerar e só então `saldo_comprado`; saldos podem ficar
   negativos apenas pelo overdraft da última chamada (nunca por crédito mal aplicado).
3. Existe a RPC `debitar_tokens(p_empresa_id, p_user_id, p_agent_key, p_agent_run_id,
   p_model, p_tokens_input, p_tokens_output, p_idempotency_key)`, `SECURITY DEFINER`,
   executável só por `service_role`, idempotente: a mesma `p_idempotency_key` da mesma
   empresa nunca gera duas linhas.
4. Existe `ai_model_precos` (modelo, preço por milhão de tokens de entrada e de saída, moeda,
   `vigente_desde`); `debitar_tokens` grava `custo_estimado` usando o preço vigente na hora
   do evento. Modelo sem preço cadastrado não quebra o débito: grava custo NULL e reporta
   warning ao Sentry.
5. `_shared/ai-client.ts` passa a registrar todo uso via `debitar_tokens`, levando `user_id`
   (novo: hoje o log não o tem) e `agent_run_id` quando existir. `logAiUsage`/
   `recordAiUsage`/`increment_ai_usage` deixam de ser chamados (código morre; tabelas ficam
   até o passo de deprecação).
6. Falha no débito **não** quebra a resposta de IA ao usuário (mesma postura do código
   atual), mas deixa de ser silenciosa: reporta ao Sentry com `empresa_id` e `agent_key`.
7. Existem as views `v_uso_tokens_por_usuario`, `v_uso_tokens_por_agente` e
   `v_uso_tokens_por_empresa` (mês a mês, tokens in/out e custo), lendo só do ledger,
   com `security_invoker` (RLS do ledger vale nelas).
8. Backfill: linhas históricas de `ai_usage_logs` entram no ledger como `source='usage'`
   com `user_id` NULL; `agent_runs` concluídos com tokens > 0 idem, com `user_id` =
   `created_by` e `agent_run_id` preenchido, sem dupla contagem entre as duas origens
   (runs que já logaram em `ai_usage_logs` entram por uma origem só).
9. Nenhuma tabela antiga é dropada nesta spec. `ai_usage` e `ai_usage_logs` ficam
   read-only de fato (nada mais escreve nelas) e a deprecação é spec futura.

Não-funcionais:

- **Segurança / RLS:** ledger e saldo com `empresa_id = get_user_empresa_id()` no SELECT;
  nenhuma policy de escrita para `authenticated`/`anon`; RPC nova segue o padrão endurecido
  (REVOKE de `anon`; atenção ao achado de 27/08: DROP+CREATE reabre grant endurecido, e
  função com overload exige DROP+CREATE, nunca só CREATE OR REPLACE).
- **Performance:** gate e trigger são O(1) por chamada; índice `(empresa_id, created_at DESC)`
  e `(empresa_id, agent_key)` no ledger; unique parcial em `reference_id` e em
  `(empresa_id, idempotency_key)`.
- **Multi-tenant:** `empresa_id NOT NULL` no ledger; isolamento testado com `auth.uid()` real.

## Critérios de aceite

- [ ] Dado um débito de 1.000 tokens numa empresa com `saldo_plano=600` e
      `saldo_comprado=500`, quando `debitar_tokens` roda, então o ledger ganha as linhas do
      evento e o saldo final é `saldo_plano=0`, `saldo_comprado=100`.
- [ ] Dado a mesma `idempotency_key` enviada duas vezes (retry), quando a segunda chega,
      então nenhuma linha nova é criada e o saldo não muda.
- [ ] Dado duas chamadas concorrentes da mesma empresa, quando ambas debitam, então o saldo
      final é exatamente a soma dos dois débitos (sem lost update; teste com transações
      paralelas).
- [ ] Dado saldo já em zero, quando um débito chega (chamada em voo), então o débito é
      aceito e o saldo fica negativo no valor exato do overdraft (o bloqueio é da Fase 2).
- [ ] Dado usuário autenticado da empresa A, quando consulta ledger, saldo ou views, então
      vê só linhas da empresa A; INSERT direto por `authenticated` falha.
- [ ] Dado um modelo sem linha em `ai_model_precos`, quando o débito roda, então a linha
      entra com `custo_estimado` NULL e um warning chega ao Sentry.
- [ ] Dado o backfill executado em staging, quando se compara `SUM(tokens)` do ledger com
      (`ai_usage_logs` + runs sem log correspondente), então os totais batem e nenhum run
      foi contado duas vezes.
- [ ] Caso de borda: empresa sem linha em `ai_token_saldo` (empresa antiga), quando o
      primeiro débito chega, então a linha de saldo nasce na hora (upsert), sem erro.
- [ ] Shadow mode: com tudo deployado em staging, nenhuma chamada de IA é bloqueada por
      saldo, independente do valor.

## Dados e contratos

- Migrations: `ai_token_ledger`, `ai_token_saldo`, `ai_model_precos`, trigger
  `tg_aplicar_delta_no_saldo`, RPC `debitar_tokens`, 3 views. Depois: `npm run gen:types`
  (staging) e commit do `types.ts` (gate `types-sync` bloqueia PR sem isso).
- `debitar_tokens` retorna `{ saldo_plano, saldo_comprado }` pós-débito (a Fase 2 vai usar
  isso para o gate sem leitura extra).
- Shape do ledger e enums de `source`: conforme ADR 0035.
- Seed de `ai_model_precos`: preços oficiais vigentes do provider na data da migration
  (conferir tabela oficial na implementação, não usar número de memória).

## Plano de implementação

Proposto; aprovar antes de codar (plan mode).

1. Migration das 3 tabelas + trigger + RPC + views, com RLS e grants endurecidos; testes
   pgTAP ou SQL de aceite dos cenários acima no banco local.
2. `gen:types:local`, ajuste de `_shared/ai-client.ts` (novo caminho de débito com
   `user_id`/`agent_run_id`; remoção das chamadas antigas), typecheck de functions.
3. Backfill como migration separada e idempotente (re-rodável sem duplicar).
4. Deploy em staging (migration via CD, nunca via MCP: migrations por MCP viram órfãs),
   `functions:deploy:staging`, validação dos critérios com dado real.
5. Janela de shadow de 14 dias em produção: comparar diariamente saldo vs SUM do ledger
   (query pronta no PR); divergência zero fecha a fase.

## Decisões e riscos

- Arquitetura: [ADR 0035](../architecture/adr/0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md).
- Risco: alguma chamada LLM fora do `ai-client.ts` (caminho direto ao provider) escaparia do
  ledger; varrer `supabase/functions/` por uso direto do fetch do Gemini na implementação.
- Risco: backfill de `agent_runs` vs `ai_usage_logs` pode ter interseção não óbvia (runs que
  também logaram); o critério de aceite de dupla contagem existe exatamente para isso.
- Suposição: volume atual de chamadas cabe com folga em trigger por INSERT; revisitar
  (particionamento) só com dado do painel da Fase 5.
