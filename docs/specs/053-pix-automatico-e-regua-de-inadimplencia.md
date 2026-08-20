# SPEC: Pix Automático e régua de inadimplência do MRR

**Data:** 2026-08-19
**Status:** Draft
**Autor:** Matheus Rezende
**Módulo:** billing (assinatura do próprio Pilar)

## Problema

Duas falhas abertas no motor de cobrança do próprio Pilar, as duas custando
receita no dia do lançamento:

1. **Churn involuntário.** O checkout só oferece cartão, Pix avulso e boleto
   (`pilar-checkout-create`, `billing_type` em `CREDIT_CARD | PIX | BOLETO`). No
   cartão, a cobrança falha sozinha quando o cartão vence, é trocado ou nega, e o
   cliente cancela sem querer cancelar. No Pix avulso e no boleto, alguém do
   escritório precisa pagar à mão todo mês, o que gera atraso recorrente. Além
   disso, o cartão custa 3,13% do ticket contra 0,36% do Pix.
2. **Inadimplente continua usando o sistema de graça.** O webhook marca
   `pilar_subscriptions.status = 'overdue'` no evento `PAYMENT_OVERDUE`, e o
   `PrivateRoute` só bloqueia em `canceled` e `expired`. Ninguém é avisado,
   ninguém é cobrado de novo e nada acontece: `overdue` é um estado escrito no
   banco que não produz efeito nenhum.

Quem sente: o sócio do escritório de engenharia que quer pagar e não quer
lembrar de pagar, e a Labrynth, que perde MRR por falha operacional em vez de
insatisfação com o produto.

## Objetivo

Assinatura que se renova sozinha sem cartão, e inadimplência que percorre uma
régua determinística até a suspensão, com aviso em cada etapa. Depois desta
feature, a receita só cai quando o cliente decide sair, não quando o meio de
pagamento falha em silêncio.

**Fora de escopo:**

- Proration ao trocar de plano no meio do ciclo (`update_plan` continua trocando
  o valor da próxima cobrança, sem crédito proporcional).
- Cobrança em outra moeda, Merchant of Record, Stripe. Fechado pelo
  [ADR 0028](../architecture/adr/0028-asaas-como-gateway-do-mrr-com-pix-automatico.md).
- Cupom, desconto e período promocional.
- Emissão de NFS-e, que entra na sequência (o ADR 0028 já fixa o fornecedor).
- Dunning por WhatsApp. Só e-mail e notificação no app nesta versão.

## Requisitos

Funcionais, numerados e testáveis:

**Pix Automático**

1. O checkout oferece "Pix Automático" como primeira opção, com cartão e boleto
   abaixo, e explica em uma linha que o banco debita todo mês depois de uma
   autorização única.
2. Ao escolher Pix Automático, o sistema cria a autorização no Asaas
   (`POST /v3/pix/automatic/authorizations`) com `frequency` derivada do
   `billing_cycle`, `contractId` igual ao id do `pilar_pending_signups`,
   `paymentCreationMode: SUBSCRIPTION` e
   `retryPolicy: ALLOW_THREE_IN_SEVEN_DAYS`, e devolve ao front o QR Code do
   primeiro pagamento.
3. Ao receber `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`, o sistema
   registra a autorização como ativa na assinatura.
4. Se a empresa não for elegível a Pix Automático (CNPJ com menos de 6 meses,
   CNAE incompatível, conta não liberada) ou o Asaas recusar a criação, o
   checkout mostra a indisponibilidade e mantém cartão e boleto funcionando. A
   falha nunca deixa o usuário sem caminho de pagamento.
5. Ao receber `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED`, a
   assinatura entra na régua de inadimplência (requisito 7), sem virar
   `canceled` de imediato.
6. O admin da empresa vê em `src/pages/billing/` qual é o meio de pagamento
   ativo e, quando for Pix Automático, o status da autorização.

**Régua de inadimplência**

7. Ao entrar em `overdue`, a assinatura ganha `overdue_since` e um estágio de
   régua. Os estágios e as ações são fixos, contados em dias corridos desde
   `overdue_since`:
   - dia 0: e-mail "não conseguimos confirmar seu pagamento" com link para
     regularizar, e notificação no app.
   - dia 3: segundo e-mail e banner persistente no app para o admin.
   - dia 7: terceiro aviso e banner para todos os usuários da empresa.
   - dia 10: **suspensão**. `status = 'suspended'`, app bloqueado com a tela de
     regularização.
   - dia 30: `status = 'canceled'` e assinatura encerrada no Asaas.
8. Um cron diário processa a régua, é idempotente (uma coluna de timestamp por
   etapa enviada, no padrão de `trial_warning_*d_sent_at`) e registra cada ação
   em `admin_audit_logs` com `category = 'billing'`.
9. `PrivateRoute` bloqueia o app em `suspended`, além de `canceled` e `expired`.
   Em `overdue` o app continua liberado, com banner.
10. Ao receber `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` de uma assinatura em
    `overdue` ou `suspended`, o sistema volta a assinatura para `active`, limpa
    `overdue_since` e os timestamps de etapa, e estende `current_period_end`. A
    recuperação é automática e imediata, sem ação humana.
11. O ultra admin vê, por empresa, o estágio de régua e a data de suspensão
    prevista.

Não-funcionais:

- **Segurança e RLS:** `pilar_subscriptions` continua legível só pela própria
  empresa via `empresa_id`; as colunas novas de régua não abrem leitura para
  outra empresa. O cron roda com service role e nunca é exposto sem token
  (`Authorization: Bearer <SERVICE_ROLE_KEY>`, padrão do `trial-expiry-cron`).
- **Idempotência:** o webhook mantém o índice único por `(event, asaas_payment_id)`
  e `(event, asaas_subscription_id)`; os eventos novos de Pix Automático entram
  no mesmo esquema de log em `pilar_checkout_webhook_logs`.
- **Multi-tenant:** nenhuma etapa da régua pode alterar assinatura de outra
  empresa; toda escrita filtra por `id` da assinatura resolvida pelo
  `asaas_subscription_id` recebido.
- **Segredo:** a chave de plataforma e o webhook token seguem em variável de
  ambiente por ambiente, sandbox em staging (ADR 0007).

## Critérios de aceite

**Pix Automático**

- [ ] Dado um checkout com CNPJ elegível, quando o usuário escolhe Pix
      Automático e paga o QR Code inicial, então a assinatura nasce `active`,
      guarda o id da autorização e o convite de acesso é disparado uma única vez.
- [ ] Dado que o Asaas recusa a criação da autorização, quando o usuário submete
      o checkout, então a tela informa que o Pix Automático está indisponível e
      permite concluir por cartão ou boleto sem recarregar a página.
- [ ] Dado um webhook `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED`
      duplicado, quando ele chega duas vezes, então o segundo é ignorado e nada
      muda no banco.
- [ ] Dado um webhook `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED`,
      quando processado, então a assinatura fica `overdue` com `overdue_since`
      preenchido, e não `canceled`.

**Régua**

- [ ] Dada uma assinatura `overdue` há 3 dias sem o aviso de 3 dias enviado,
      quando o cron roda, então o e-mail sai, o timestamp da etapa é gravado e o
      audit log registra a ação.
- [ ] Dada a mesma assinatura, quando o cron roda de novo no mesmo dia, então
      nenhum e-mail é reenviado.
- [ ] Dada uma assinatura `overdue` há 10 dias, quando o cron roda, então
      `status = 'suspended'` e qualquer navegação no app cai na tela de
      regularização.
- [ ] Dada uma assinatura `suspended`, quando chega `PAYMENT_CONFIRMED`, então
      ela volta para `active`, `overdue_since` e os timestamps de etapa ficam
      nulos, e o usuário volta a navegar sem novo login.
- [ ] Caso de borda: assinatura em trial (`trialing`) com pagamento em atraso não
      entra na régua duas vezes, isto é, `trial-expiry-cron` e o cron de régua
      não podem os dois mudar o status no mesmo dia.
- [ ] Caso de borda: assinatura já `canceled` é ignorada pela régua.
- [ ] Caso de borda: fuso. A contagem de dias usa data em UTC no banco e o
      e-mail mostra a data no fuso de São Paulo.

## Dados e contratos

**Migration em `pilar_subscriptions`:**

```sql
alter table pilar_subscriptions
  add column pix_automatic_authorization_id text,
  add column pix_automatic_status text,          -- CREATED | ACTIVE | CANCELED
  add column overdue_since timestamptz,
  add column dunning_d0_sent_at timestamptz,
  add column dunning_d3_sent_at timestamptz,
  add column dunning_d7_sent_at timestamptz,
  add column suspended_at timestamptz;

create index on pilar_subscriptions (pix_automatic_authorization_id);
create index on pilar_subscriptions (status, overdue_since);
```

`status` passa a aceitar `suspended`. `billing_type` passa a aceitar
`PIX_AUTOMATICO`. Mesmas colunas espelhadas no que `pilar_pending_signups`
precisar para o primeiro pagamento.

**Edge functions:**

- `_shared/asaas-platform.ts`: `createPixAutomaticAuthorization`,
  `getPixAutomaticAuthorization`, `cancelPixAutomaticAuthorization`.
- `pilar-checkout-create`: `billing_type` ganha `PIX_AUTOMATICO`; retorno ganha
  `pix_automatic: { authorization_id, qr_code, payload, expires_at }`.
- `pilar-checkout-webhook`: trata os cinco eventos
  `PIX_AUTOMATIC_RECURRING_*` e a recuperação de `overdue` e `suspended`.
- `pilar-dunning-cron` (nova): sem JWT de usuário,
  `Authorization: Bearer <service role>`, processa a régua, retorna
  `{ processed, emails_sent, suspended, canceled }`.

**Front:**

- `src/pages/checkout/index.tsx`: opção Pix Automático com QR Code e cópia do
  payload.
- `src/components/PrivateRoute.tsx`: `suspended` entra no gate.
- `src/pages/billing/`: meio de pagamento ativo, status da autorização, banner
  de régua.
- Banner de inadimplência ao lado do `TrialBanner` existente.

Depois de qualquer migration: `npm run gen:types` e commit do `types.ts`, senão o
job `types-sync` reprova o PR.

## Plano de implementação

A aprovar antes de gerar código.

1. Confirmar a elegibilidade da conta Labrynth para Pix Automático no painel do
   Asaas (CNPJ com 6 meses, CNAE, liberação PJ). Se não estiver liberada, os
   passos 3 a 5 param e a régua (passos 6 a 9) segue sozinha, porque ela vale
   para cartão e boleto também.
2. Migration das colunas e do novo status, mais `gen:types:local`.
3. `_shared/asaas-platform.ts`: as três operações de autorização, com teste de
   contrato contra o sandbox.
4. `pilar-checkout-create`: novo `billing_type`, fallback explícito quando o
   Asaas recusa.
5. `pilar-checkout-webhook`: eventos de Pix Automático e recuperação automática.
6. `pilar-dunning-cron`: régua idempotente com audit log.
7. `PrivateRoute` e tela de regularização para `suspended`.
8. Banner de inadimplência e painel de billing.
9. Agendar o cron por ambiente (pg_cron, um por ambiente, nunca via MCP) e
   validar em staging com a conta sandbox.

## Decisões e riscos

- Arquitetura fechada no
  [ADR 0028](../architecture/adr/0028-asaas-como-gateway-do-mrr-com-pix-automatico.md):
  Asaas como gateway do MRR, fronteira única em `asaas-platform.ts`.
- **Risco de elegibilidade.** Se a conta da plataforma não estiver liberada para
  Pix Automático no lançamento, o ganho de custo e de churn não vem, e o cartão
  volta a ser o padrão. A régua cobre os dois casos, então ela é o item de maior
  retorno e deve ser feita primeiro.
- **Risco de cobertura bancária.** Cerca de 85% dos bancos suportavam Pix
  Automático em abril de 2026. Cliente em banco fora dessa lista precisa de
  cartão ou boleto, então o fallback do requisito 4 não é opcional.
- **Risco de suspender cliente bom.** A régua de 10 dias é agressiva para B2B,
  onde o financeiro do cliente costuma pagar em lote. Suposição a validar com os
  primeiros pagantes: se gerar atrito, o parâmetro de dias vira configuração no
  ultra admin em vez de constante no código.
- **Risco de cron não agendado.** O `trial-expiry-cron` existe e não está
  agendado em produção, e o trial hoje não expira por decisão explícita. O cron
  de régua não pode repetir isso: sem agendamento, a régua é código morto e o
  inadimplente segue usando de graça.
