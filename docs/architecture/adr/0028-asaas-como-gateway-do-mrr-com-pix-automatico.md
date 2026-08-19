# ADR 0028: Cobrar o MRR do Pilar pelo Asaas, com Pix Automático como método padrão

**Data:** 2026-08-19
**Status:** Accepted

## Contexto

O Pilar entra em lançamento comercial e precisa cobrar a própria assinatura
(o MRR da Labrynth). Isso é diferente do Asaas B2B já existente em `asaas_config`,
onde cada empresa cliente usa a chave dela para cobrar os clientes dela. Aqui a
chave é única e da plataforma.

**Estado real do código (auditado em 2026-08-19):** a operação de cobrança do
próprio SaaS já existe e não é protótipo.

- `supabase/functions/_shared/asaas-platform.ts`: cliente HTTP com chave da
  plataforma (`ASAAS_PLATFORM_API_KEY`), sandbox e produção.
- `supabase/functions/pilar-checkout-create/index.ts`: checkout público,
  `billing_type` em `CREDIT_CARD | PIX | BOLETO`, cria customer, subscription e
  `pilar_pending_signups`, com rate limit por IP.
- `supabase/functions/pilar-checkout-webhook/index.ts`: idempotente por índice
  único, grava `pilar_checkout_webhook_logs`, libera o convite no
  `PAYMENT_CONFIRMED`, marca `overdue` no `PAYMENT_OVERDUE`, cancela no refund.
- `supabase/functions/pilar-subscription-manage/index.ts`: `update_plan` e
  `cancel`, restrito a admin da empresa.
- Tabelas `pilar_subscriptions`, `pilar_subscription_plans`,
  `pilar_pending_signups`; `trial-expiry-cron`; gate de acesso em
  `src/components/PrivateRoute.tsx`; UI em `src/pages/checkout/index.tsx` e
  `src/pages/billing/`.

A pergunta que este ADR fecha é se vale trocar esse motor por Stripe, RevenueCat,
um Merchant of Record (Paddle, Lemon Squeezy) ou outro adquirente nacional
antes do lançamento.

**Custo por assinante, ticket de referência de R$ 690/mês** (tabela pública de
cada fornecedor em 2026-08, fora de promoção):

| Opção                  | Método                          | Taxa                           | Custo               | % do ticket  |
| ---------------------- | ------------------------------- | ------------------------------ | ------------------- | ------------ |
| Asaas                  | Pix / Pix Automático            | R$ 1,99 fixo                   | R$ 2,48 (com NFS-e) | 0,36%        |
| Asaas                  | Boleto                          | R$ 1,99 fixo                   | R$ 2,48             | 0,36%        |
| Asaas                  | Cartão de crédito               | 2,99% + R$ 0,49                | R$ 21,61            | 3,13%        |
| Stripe                 | Cartão + Billing                | 3,99% + R$ 0,39 + 0,7%         | R$ 32,75            | 4,75%        |
| Stripe                 | Pix + Billing                   | 1,19% + 0,7%                   | R$ 13,04            | 1,89%        |
| Iugu                   | Cartão                          | 4,99%                          | R$ 34,43            | 4,99%        |
| Pagar.me               | Cartão à vista (tabela pública) | 5,59%                          | R$ 38,57            | 5,59%        |
| Vindi                  | negociado                       | R$ 199/mês + taxas             | fixo + variável     | só em volume |
| Paddle / Lemon Squeezy | Merchant of Record              | 5% + US$ 0,50                  | ~R$ 37,20           | ~5,4%        |
| RevenueCat             | camada sobre gateway            | 1% do MTR acima de US$ 2,5 mil | empilha no gateway  | +1%          |

Em um mix realista de 60% Pix e 40% cartão, o Asaas custa 1,5% do MRR de forma
constante. Com 200 assinantes (R$ 138 mil de MRR), a diferença contra
Stripe mais emissor de NFS-e externo passa de R$ 4,8 mil por mês.

**Opções consideradas:**

- **A. Manter Asaas, Pix Automático como padrão.** Prós: menor custo do
  mercado, custo fixo por cobrança em vez de percentual, NFS-e municipal na
  mesma conta por R$ 0,49, Pix Automático elimina churn involuntário por cartão
  vencido, e o código já existe. Contras: dunning e proration são mais pobres
  que Stripe Billing, nada de multi-moeda, Pix Automático exige CNPJ ativo há
  6 meses e liberação gradual para PJ.
- **B. Migrar para Stripe (Payments + Billing).** Prós: melhor produto de
  assinatura do mercado (Smart Retries, proration, Customer Portal, Tax),
  multi-moeda. Contras: 4,75% no cartão contra 3,13%, não emite NFS-e brasileira
  (exige eNotas de R$ 137 a R$ 347 por mês ou NFE.io por fora), Pix na Stripe BR
  é mediante convite, e joga fora as quatro edge functions já prontas.
- **C. Iugu, Pagar.me ou Vindi.** Contras: taxa de cartão pior na tabela
  pública, e a Vindi cobra mensalidade a partir de R$ 199 antes da primeira
  venda. Nenhum ganho de produto que justifique.
- **D. Merchant of Record (Paddle, Lemon Squeezy).** Prós: o fornecedor assume
  a obrigação fiscal global. Contras: recebimento em USD com câmbio e IOF,
  invoice internacional em vez de NFS-e no CNPJ do cliente, e o ICP é escritório
  de engenharia brasileiro que precisa da nota para deduzir. Resolve um problema
  que o Pilar não tem.
- **E. RevenueCat.** Não é gateway, é camada de gestão de assinatura desenhada
  para compra in-app de App Store e Google Play. Cobraria 1% do MTR **em cima**
  do gateway. O Pilar Campo é PWA (spec 042), não passa por IAP, então não há o
  problema que o RevenueCat resolve.

## Decisão

Cobrar o MRR do Pilar pelo **Asaas**, com **Pix Automático como método padrão**
oferecido no checkout, cartão de crédito como alternativa e boleto para a
empresa que exigir.

1. **Fronteira única.** Todo acesso ao gateway passa por
   `supabase/functions/_shared/asaas-platform.ts`. Nenhuma edge function nova
   chama `api.asaas.com` direto. Isso é o que mantém a troca de fornecedor num
   custo de dias, não de semanas.
2. **Pix Automático é recurso distinto de Assinatura no Asaas.** A autorização
   é criada em `POST /v3/pix/automatic/authorizations` com `customerId`,
   `frequency`, `contractId`, `startDate` e `immediateQrCode`; o pagador autoriza
   uma vez no QR Code do primeiro pagamento e as cobranças seguintes carregam
   `pixAutomaticAuthorizationId`. Usar `paymentCreationMode: SUBSCRIPTION` para
   o Asaas seguir gerando as cobranças do ciclo, e `retryPolicy:
ALLOW_THREE_IN_SEVEN_DAYS` para ter retentativa nativa. Sem isso, criar cada
   instrução de cobrança viraria responsabilidade do Pilar.
3. **NFS-e pelo próprio Asaas** (R$ 0,49 por emissão), disparada no evento de
   pagamento confirmado. Nenhum emissor externo entra no stack agora.
4. **A régua de inadimplência é responsabilidade do Pilar**, não do gateway. O
   status `overdue` em `pilar_subscriptions` hoje não bloqueia nada no
   `PrivateRoute` (só `canceled` e `expired` bloqueiam). Fechar isso é a
   [SPEC 053](../../specs/053-pix-automatico-e-regua-de-inadimplencia.md).
5. **Gatilhos explícitos de reavaliação.** Reabrir esta decisão em um novo ADR
   quando ocorrer qualquer um: primeiro cliente fora do Brasil, necessidade de
   cobrança em mais de uma moeda, app nativo com compra in-app, ou perda de
   receita por falha de cobrança acima de 2% do MRR por três meses seguidos.

```ts
// _shared/asaas-platform.ts: a autorização de Pix Automático entra como
// operação nova ao lado de createSubscription, mantendo a fronteira.
export async function createPixAutomaticAuthorization(input: {
  customerId: string;
  frequency: "MONTHLY" | "ANNUALLY";
  contractId: string; // id do pending_signup ou da subscription
  startDate: string;
  value: number;
  paymentCreationMode: "SUBSCRIPTION";
  retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS";
  immediateQrCode: { expirationSeconds: number; originalValue: number };
}): Promise<{ id: string; status: string; immediateQrCode: { conciliationIdentifier: string } }>;
```

## Consequências

**Positivas:**

- Custo de aquisição de receita cai para cerca de 1,5% do MRR no mix esperado,
  contra 4,75% a 5,5% em qualquer alternativa internacional.
- Churn involuntário por cartão expirado ou negado deixa de ser a maior fonte de
  cancelamento não intencional, que é o padrão de SaaS brasileiro.
- NFS-e, cobrança e conciliação ficam num único fornecedor e num único painel.
- Zero reescrita: checkout, webhook idempotente e gestão de plano continuam
  valendo.
- A fronteira em `asaas-platform.ts` deixa o custo de saída baixo e conhecido.

**Negativas:**

- O Pilar assume o que o Stripe Billing daria de graça: régua de inadimplência,
  proration em troca de plano no meio do ciclo e comunicação de cobrança. Dívida
  aceita de olhos abertos, escopo na SPEC 053.
- Pix Automático depende de elegibilidade (CNPJ ativo há 6 meses, CNAE
  compatível, liberação gradual para PJ) e da cobertura do banco do pagador
  (cerca de 85% dos bancos em abril de 2026). O checkout precisa degradar para
  cartão ou boleto sem quebrar.
- Venda internacional está fechada até um novo ADR. Se aparecer lead de fora,
  a decisão vira bloqueio de negócio, não detalhe técnico.
- Fornecedor único concentra risco operacional: indisponibilidade do Asaas para
  o dinheiro entrar e para a nota sair ao mesmo tempo.

## Decisões relacionadas

- [ADR 0007](./0007-ambiente-explicito-em-comando-destrutivo.md): a chave da
  plataforma e o webhook token são segredo por ambiente, sandbox em staging.
- [ADR 0026](./0026-feature-madura-universal-toggle-vira-capacidade.md):
  capacidade (`max_projetos`) é o limitador de plano, então a cobrança é por
  assinatura e capacidade, não por feature.
- [SPEC 039](../../specs/039-self-serve-signup-e-google.md): cadastro self-serve e
  trial de 14 dias, que é o funil que alimenta esta cobrança.
- [SPEC 053](../../specs/053-pix-automatico-e-regua-de-inadimplencia.md):
  implementação de Pix Automático e da régua de inadimplência.
- [`docs/strategy/PRICING.md`](../../strategy/PRICING.md): ticket e planos que
  definem o valor cobrado.
