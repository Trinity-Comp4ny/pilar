# SPEC: Motor de tokens, enforcement e superfícies mínimas (Fase 2 + chip/copy)

**Data:** 2026-08-31
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Fase 2 de [MOTOR_DE_TOKENS.md](../strategy/MOTOR_DE_TOKENS.md), mais as superfícies
> mínimas de cliente que a validação em staging expôs (chip de saldo, markdown do chat,
> header padrão). Decisão do CEO em 31/08: o sistema completo amadurece em STAGING;
> nenhuma promoção para main/produção por enquanto. Compra de pacote (Fase 3), extrato,
> alerta de saldo baixo e painel interno (Fases 4-5) ficam para specs seguintes.

## Problema

O ledger (spec 074) mede tudo mas não bloqueia nada: saldo negativo sem consequência,
cota não existe por plano, e a UI ainda fala "créditos" com um contador de requests.
Sem enforcement, token não é sistema de cobrança; é telemetria.

## Objetivo

Cota mensal de tokens por plano concedida a cada ciclo, chamada de IA bloqueada com
mensagem clara quando o saldo zera, e a superfície do chat falando token de verdade
(saldo real dos dois baldes, markdown renderizado, header no padrão da casa).

**Fora de escopo:** compra de pacote (Asaas, Fase 3), extrato navegável, alerta de
saldo baixo via notificações, painel ultra-admin (Fase 5), qualquer deploy em produção.

## Requisitos

1. `pilar_subscription_plans.tokens_mensais` existe; hipótese seedada: Essencial 500 mil,
   Profissional 2 milhões, Escala 8 milhões (números NÃO são promessa de venda; calibrar
   com o dado da Fase 0 antes de qualquer copy pública).
2. RPC `gate_tokens(p_empresa_id)`: garante a concessão do ciclo corrente (idempotente
   por mês via `reference_id` `plan_grant:<empresa>:<AAAA-MM>`) e retorna os saldos.
   Na virada de ciclo, o que sobrou do balde do plano expira (`plan_expire`, novo source,
   delta negativo no balde do plano) e a cota cheia entra (`plan_grant`). Balde comprado
   nunca expira. Empresa sem assinatura ativa/trial usa a cota do plano de entrada.
3. Toda edge function de IA bloqueia ANTES de chamar o modelo quando
   `saldo_plano + saldo_comprado <= 0`, com **HTTP 402** e mensagem que diz o que houve
   e o próximo passo. A janela curta anti-rajada (30/60s) continua com HTTP 429.
   O teto mensal por REQUESTS morre (o token é a cota agora).
4. O payload de saldo do `ai-chat` traz os dois baldes em tokens; o chip do header mostra
   o total restante formatado (pt-BR compacto) e o detalhe por balde no title.
5. Copy: "crédito de IA" some das superfícies do chat; cards de confirmação dizem que a
   ação consome tokens de IA (sem prometer quantidade fixa).
6. Resposta do agente renderiza markdown básico (negrito, listas, código inline);
   mensagem do usuário continua texto puro.
7. Header do `/agentes` usa o `PageHeader` padrão (spec 002), sempre visível, com o chip
   de saldo e "Nova conversa" como ações secundárias.
8. `gate_tokens` cobre a virada de mês on-demand (primeira chamada de IA do mês concede o
   ciclo sem depender de cron). Agendar o pg_cron mensal continua como passo manual por
   ambiente (mesmo padrão dos alertas ambient) para o saldo renovar mesmo sem uso.

Não-funcionais: RPC nova segue o padrão endurecido (REVOKE PUBLIC/anon/authenticated,
GRANT service_role, guard no corpo); multi-tenant intacto; concessão e expiração são
linhas normais do ledger (nenhum contador paralelo).

## Critérios de aceite

- [ ] Dado empresa sem grant no mês, quando `gate_tokens` roda, então nasce `plan_grant`
      com a cota do plano e o saldo do plano fica igual à cota.
- [ ] Dado `gate_tokens` rodado duas vezes no mesmo mês, então existe UM `plan_grant` do
      mês e o saldo não muda na segunda chamada.
- [ ] Dado sobra de 12k no plano na virada do ciclo, quando o novo ciclo concede, então
      existe `plan_expire` de -12k e `plan_grant` da cota cheia; `saldo_comprado` intacto.
- [ ] Dado saldo total <= 0, quando qualquer function de IA é chamada, então responde 402
      antes de chamar o Gemini, e o front mostra a mensagem de tokens esgotados.
- [ ] Dado saldo positivo, quando o turno roda, então nada muda no fluxo atual (débito
      pós-resposta, overdraft da chamada em voo aceito).
- [ ] Chip do chat mostra o saldo real em tokens e atualiza a cada resposta.
- [ ] Resposta com `**negrito**` e listas renderiza formatada, sem asteriscos crus.

## Dados e contratos

- Migration: coluna `tokens_mensais`, source `plan_expire` no CHECK do ledger + trigger,
  RPC `gate_tokens`, bootstrap de concessão para empresas existentes. `gen:types` depois.
- `gate_tokens` retorna `(saldo_plano bigint, saldo_comprado bigint, cota_ciclo bigint)`.
- Payload `saldo` do ai-chat: `{ tokens_plano, tokens_comprado, tokens_restantes }`.
- pgTAP estendido em `supabase/tests/ai_token_ledger.sql`.

## Plano de implementação

1. Migration `20260880...`: coluna+seed, CHECK/trigger com `plan_expire`, `gate_tokens`,
   bootstrap; pgTAP dos critérios acima.
2. `_shared/ai-client.ts`: `verificarTokens()` (gate 402), `checkRateLimit` vira só
   anti-rajada, `getAiSaldo` re-shape em tokens; 14 handlers ganham o gate 402.
3. Front: chip/copy/markdown/header; `erros.ts` com 402 de tokens.
4. Verificação: pgTAP local, typecheck, vitest, deploy staging via PR, teste manual no
   preview (chat responde formatado, chip em tokens, saldo bloqueia quando zerado).

## Decisões e riscos

- ADR 0035 continua valendo (fonte única); expiração/concessão são sources novos, não
  estrutura nova.
- Risco: números de cota são hipótese; em staging isso é inofensivo, mas nada disso vira
  material de venda antes da Fase 0 medir produção.
- Risco: bloquear por saldo em staging pode travar teste de outro fluxo; mitigação: o
  bootstrap concede o ciclo a todas as empresas e o `gate_tokens` renova on-demand.
