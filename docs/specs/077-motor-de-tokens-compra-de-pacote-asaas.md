# SPEC: Motor de tokens, Fase 3: compra avulsa de pacote via Asaas

**Data:** 2026-09-01
**Status:** Aprovada
**Autor:** Matheus (CEO) + Claude
**Módulo:** ia / billing (transversal)

> Fase 3 de [MOTOR_DE_TOKENS.md](../strategy/MOTOR_DE_TOKENS.md).
> Constrói sobre [ADR 0035](../architecture/adr/0035-ledger-de-tokens-fonte-unica-de-uso-de-ia.md)
> (ledger) e [ADR 0028](../architecture/adr/0028-asaas-como-gateway-do-mrr-com-pix-automatico.md)
> (Asaas como gateway), usando o **Sistema B** (Asaas da plataforma, Labrynth cobra o cliente
> do Pilar) — correção de escopo registrada em `project_auditoria_asaas_ativacao_2026-09-01`
> depois de a Fase 3 ter sido descrita por engano com o Asaas por-empresa (Sistema A).

## Problema

O cliente que estoura a cota mensal de tokens (Fase 2, gate ativo) fica bloqueado até a
renovação do ciclo, sem opção de resolver na hora. O modelo econômico promete "compra pacote
avulso, opt-in" (princípio 1 do MOTOR_DE_TOKENS.md) mas essa compra ainda não existe: hoje
zero caminho credita `saldo_comprado` fora do backfill/ajuste manual.

## Objetivo

Uma empresa paga (com assinatura ativa no Sistema B) consegue comprar pacotes de 500 mil
tokens avulsos, pagos via Asaas (Pix, boleto ou cartão), com o crédito caindo no
`saldo_comprado` assim que o pagamento é confirmado — sem duplicar crédito em replay de
webhook.

**Fora de escopo:**
- Botão/tela de compra na UI (Fase 4 — aqui a compra é verificada via chamada direta ao
  endpoint, como toda fase anterior deste motor foi verificada antes de ganhar UI).
- Compra por empresa **isenta** (sem assinatura paga no Sistema B): quem não tem
  `pilar_subscriptions.asaas_customer_id` não tem como comprar ainda — precisa antes converter
  para pagante (spec 078) ou ativar cobrança. Não inventar coleta de dados de cobrança aqui.
- Alterar o tamanho do pacote (500k) ou o preço (R$49) — vêm de DECISOES.md 2026-09-01;
  mudança de preço é decisão própria, não desta spec.
- Reembolso de pacote (fica como ajuste manual via `source='refund'`, já suportado pelo
  ledger desde a Fase 1; sem fluxo automático agora).
- Any assinatura recorrente de token (isso já existe pro plano; pacote é sempre avulso).

## Requisitos

Funcionais:

1. Existe a tabela `pilar_token_pack_purchases`, uma linha por tentativa de compra, com
   `empresa_id`, `user_id` (quem comprou), `quantidade_pacotes` (>0), `tokens_pacote`
   (snapshot de 500000, protege contra mudança futura do tamanho do pacote),
   `valor_centavos` (snapshot do preço), `billing_type`, `asaas_payment_id` (único),
   `status` (`pending`/`paid`/`failed`/`canceled`), `payment_metadata` jsonb, `created_at`,
   `paid_at`.
2. Nova edge function `pilar-token-pack-create` (autenticada, JWT do usuário logado):
   - Resolve `empresa_id` do usuário (`get_user_empresa_id()`) e busca
     `pilar_subscriptions.asaas_customer_id`. Sem customer (empresa isenta) → 400 com
     mensagem clara ("sua empresa ainda não tem cobrança ativa; fale com o suporte" — texto
     final segue `brand/voice-tone.md`).
   - Aceita `{ quantidade_pacotes: 1-20, billing_type: PIX|BOLETO|CREDIT_CARD, credit_card?,
     credit_card_holder_info? }`, reusando os schemas de validação de `pilar-checkout-create`.
   - Cria a linha em `pilar_token_pack_purchases` (`status='pending'`) ANTES de chamar o
     Asaas, para já existir uma linha que o webhook possa achar por `id` mesmo se a criação
     do pagamento falhar no meio (mesmo padrão de `pilar-checkout-create`: pending_signup
     antes do customer/subscription).
   - Cria uma cobrança avulsa no Asaas (`POST /payments`, não `/subscriptions` — é compra
     pontual) com `externalReference = purchase.id` e valor = `quantidade_pacotes * 49,00`.
   - Retorna o mesmo shape de metadata que `pilar-checkout-create` (PIX QR / boleto / status
     do cartão) para o front reaproveitar o componente de exibição de pagamento.
3. `pilar-checkout-webhook` (reusado — um único webhook cadastrado no Asaas sandbox) ganha
   uma rota: quando `payment.externalReference` casa com uma linha de
   `pilar_token_pack_purchases` (busca por id, e por `asaas_payment_id` como fallback do
   mesmo jeito que já faz para `pilar_pending_signups`), em `PAYMENT_CONFIRMED`/
   `PAYMENT_RECEIVED` com `status != 'paid'`:
   - Atualiza a compra para `status='paid'`, `paid_at`, `asaas_payment_id`.
   - Insere em `ai_token_ledger`: `source='purchase'`, `agent_key='compra'`,
     `tokens_delta = quantidade_pacotes * tokens_pacote`, `empresa_id`, `user_id` do
     comprador, `reference_id = 'token_pack_purchase:' || purchase.id` (idempotência: mesmo
     em replay do webhook, o `UNIQUE` de `reference_id` barra o segundo INSERT — não precisa
     de lógica extra de dedupe na function).
4. `PAYMENT_OVERDUE`/`PAYMENT_REFUNDED`/`PAYMENT_DELETED` na mesma cobrança marcam a compra
   como `failed`/`canceled` (mesmo padrão já aplicado a `pilar_pending_signups` no webhook).

Não-funcionais:

- **Segurança / RLS:** `pilar_token_pack_purchases` — SELECT só da própria empresa
  (`empresa_id = get_user_empresa_id()`); nenhuma policy de INSERT/UPDATE/DELETE para
  `authenticated`/`anon` (escrita só por `service_role` nas duas edge functions).
- **Multi-tenant:** `pilar-token-pack-create` nunca aceita `empresa_id` do corpo da
  requisição — sempre resolve pelo JWT (`get_user_empresa_id()` via client autenticado, não
  pelo admin client, para não abrir brecha de comprar tokens para outra empresa).
- **Idempotência:** replay do webhook para o mesmo pagamento não credita duas vezes (garantia
  estrutural pelo `UNIQUE (reference_id)` do ledger, não por checagem aplicacional).

## Critérios de aceite

- [ ] Dado um usuário de empresa com assinatura ativa (tem `asaas_customer_id`), quando chama
      `pilar-token-pack-create` com `quantidade_pacotes: 1, billing_type: PIX`, então recebe
      QR code Pix e a linha em `pilar_token_pack_purchases` fica `status='pending'`.
- [ ] Dado um pagamento confirmado no Asaas (sandbox) para essa compra, quando o webhook
      processa `PAYMENT_CONFIRMED`, então `pilar_token_pack_purchases.status` vira `paid` e
      `ai_token_saldo.saldo_comprado` sobe exatamente 500000.
- [ ] Dado o mesmo evento de webhook reprocessado (replay/retry do Asaas), quando o webhook
      roda de novo, então nenhuma segunda linha de crédito é criada e o saldo não muda.
- [ ] Dado um usuário de empresa **isenta** (sem `asaas_customer_id`), quando chama
      `pilar-token-pack-create`, então recebe 400 com mensagem clara, sem criar cobrança.
- [ ] Dado `quantidade_pacotes: 3`, quando a compra é paga, então o crédito é exatamente
      `3 * 500000 = 1500000` tokens, debitável em cascata só do balde comprado (nunca some com
      `saldo_plano`).
- [ ] Caso de borda: `quantidade_pacotes` fora de 1-20 → 400 antes de tocar no Asaas.

## Dados e contratos

- **Migration nova** (`2026085xxxxxxx`, checar colisão em `origin/staging` na hora):
  `CREATE TABLE pilar_token_pack_purchases` + RLS + índice único em `asaas_payment_id`
  (parcial, `WHERE asaas_payment_id IS NOT NULL`, mesma técnica de `uq_ai_token_ledger_reference`).
- **Edge function nova:** `pilar-token-pack-create` (`--verify-jwt`, ao contrário do
  checkout de signup que é público).
- **`asaas-platform.ts` ganha `createPayment()`:** `POST /payments` (cobrança avulsa,
  distinta de `createSubscription`), mesmo formato de `creditCard`/`creditCardHolderInfo`
  de `createSubscription`.
- **`pilar-checkout-webhook`:** só adiciona a rota nova; não muda o contrato de entrada
  (mesmo payload do Asaas, mesmo header `asaas-access-token`).

## Plano de implementação

1. Migration: `pilar_token_pack_purchases` + RLS.
2. `asaas-platform.ts`: `createPayment()`.
3. `pilar-token-pack-create/index.ts`: novo, JWT obrigatório, reusa schemas de
   `_shared/schemas.ts` e o padrão de resposta de `pilar-checkout-create`.
4. `pilar-checkout-webhook/index.ts`: busca `pilar_token_pack_purchases` por
   `externalReference`/`asaas_payment_id` antes/depois da busca por `pilar_pending_signups`
   (são mutuamente exclusivos por `externalReference`, sem ambiguidade); credita o ledger.
5. pgTAP: RLS da tabela nova + teste do INSERT idempotente por `reference_id` (o mesmo padrão
   do teste de replay do backfill, adaptado).
6. Deploy via CD para staging; `npm run gen:types` (staging) e commit do `types.ts`.
7. Verificação ponta a ponta em sandbox (mesmo método que achou o bug da Fase 3
   original): criar compra real via curl, confirmar pagamento no painel sandbox do Asaas,
   checar `pilar_token_pack_purchases` e `ai_token_saldo` no banco, reenviar o mesmo evento
   de webhook manualmente para provar a idempotência.

## Decisões e riscos

- Nenhum ADR novo: reusa a arquitetura já decidida (ADR 0028 Sistema B, ADR 0035 ledger).
- Risco: empresa isenta querer comprar tokens antes de converter para pagante. Aceito por
  ora (fora de escopo); se um design partner pedir, decide-se então se vale coletar dados de
  cobrança avulsos sem assinatura — mudança de escopo, não bug.
- Risco: replay de webhook do Asaas fora de ordem (ex. `PAYMENT_REFUNDED` chega antes do
  `PAYMENT_CONFIRMED` já processado) — mesmo risco aceito que já existe no fluxo de signup,
  não introduzido por esta spec.
