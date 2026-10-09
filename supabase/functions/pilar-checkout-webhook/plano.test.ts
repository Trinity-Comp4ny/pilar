import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { dataPagamento, type Encontrados, fimDoPeriodo, planejarWebhook, referenciaCompraTokens } from "./plano.ts";

const AGORA = new Date("2026-10-07T12:00:00.000Z");

const signupPendente = { id: "s1", payment_status: "pending", invite_dispatched_at: null };
const signupJaPagoEConvidado = {
  id: "s1",
  payment_status: "paid",
  invite_dispatched_at: "2026-10-01T00:00:00.000Z",
};
const assinaturaMensal = { id: "a1", empresa_id: "e1", billing_cycle: "monthly" };
const compraPendente = { id: "c1", quantidade_pacotes: 3, tokens_pacote: 100_000, status: "pending" };
const compraPaga = { ...compraPendente, status: "paid" };

const nada: Encontrados = { signup: null, assinatura: null, compra: null };

Deno.test("pagamento de signup novo: marca pago, convida, define trial e NÃO renova assinatura", () => {
  const plano = planejarWebhook(
    "PAYMENT_CONFIRMED",
    { signup: signupPendente, assinatura: assinaturaMensal, compra: null },
    AGORA
  );
  assertEquals(plano.marcarSignupPago, true);
  assertEquals(plano.dispararConvite, true);
  assertEquals(plano.definirTrial, true);
  assertEquals(plano.renovarAssinaturaAte, null);
});

Deno.test("replay do pagamento de signup já liberado não repete pagamento nem convite", () => {
  const plano = planejarWebhook("PAYMENT_RECEIVED", { ...nada, signup: signupJaPagoEConvidado }, AGORA);
  assertEquals(plano.marcarSignupPago, false);
  assertEquals(plano.dispararConvite, false);
});

Deno.test("signup pago cujo convite falhou: reenvia o convite sem remarcar pagamento", () => {
  const plano = planejarWebhook(
    "PAYMENT_RECEIVED",
    { ...nada, signup: { ...signupJaPagoEConvidado, invite_dispatched_at: null } },
    AGORA
  );
  assertEquals(plano.marcarSignupPago, false);
  assertEquals(plano.dispararConvite, true);
});

Deno.test("renovação de assinatura mensal estende 30 dias", () => {
  const plano = planejarWebhook("PAYMENT_RECEIVED", { ...nada, assinatura: assinaturaMensal }, AGORA);
  assertEquals(plano.renovarAssinaturaAte, "2026-11-06T12:00:00.000Z");
  assertEquals(plano.statusAssinatura, null);
});

Deno.test("renovação anual estende 365 dias; ciclo nulo cai em 30", () => {
  assertEquals(fimDoPeriodo("yearly", AGORA), "2027-10-07T12:00:00.000Z");
  assertEquals(fimDoPeriodo(null, AGORA), "2026-11-06T12:00:00.000Z");
});

Deno.test("compra de tokens: credita pacotes × tokens com referência idempotente", () => {
  const plano = planejarWebhook("PAYMENT_CONFIRMED", { ...nada, compra: compraPendente }, AGORA);
  assertEquals(plano.marcarCompraPaga, true);
  assertEquals(plano.creditoTokens, { tokens: 300_000, referenceId: "token_pack_purchase:c1" });
});

Deno.test("compra já paga (cartão instantâneo) ainda credita: idempotência é do ledger, não do status", () => {
  const plano = planejarWebhook("PAYMENT_CONFIRMED", { ...nada, compra: compraPaga }, AGORA);
  assertEquals(plano.marcarCompraPaga, false);
  assertEquals(plano.creditoTokens?.tokens, 300_000);
});

Deno.test("inadimplência: assinatura overdue, signup e compra pendentes viram failed", () => {
  const plano = planejarWebhook(
    "PAYMENT_OVERDUE",
    { signup: signupPendente, assinatura: assinaturaMensal, compra: compraPendente },
    AGORA
  );
  assertEquals(plano.statusAssinatura, "overdue");
  assertEquals(plano.statusSignup, "failed");
  assertEquals(plano.statusCompra, "failed");
  assertEquals(plano.creditoTokens, null);
});

Deno.test("inadimplência não rebaixa signup ou compra que já foram pagos", () => {
  const plano = planejarWebhook(
    "PAYMENT_OVERDUE",
    { signup: signupJaPagoEConvidado, assinatura: null, compra: compraPaga },
    AGORA
  );
  assertEquals(plano.statusSignup, null);
  assertEquals(plano.statusCompra, null);
});

Deno.test("estorno cancela signup e assinatura, mas não desfaz compra já creditada", () => {
  for (const evento of ["PAYMENT_REFUNDED", "PAYMENT_DELETED"]) {
    const plano = planejarWebhook(
      evento,
      { signup: signupJaPagoEConvidado, assinatura: assinaturaMensal, compra: compraPaga },
      AGORA
    );
    assertEquals(plano.statusSignup, "canceled", evento);
    assertEquals(plano.statusAssinatura, "canceled", evento);
    assertEquals(plano.encerrarAcessoAgora, true, evento);
    assertEquals(plano.statusCompra, null, evento);
  }
});

Deno.test("estorno de compra ainda não paga cancela a compra", () => {
  const plano = planejarWebhook("PAYMENT_REFUNDED", { ...nada, compra: compraPendente }, AGORA);
  assertEquals(plano.statusCompra, "canceled");
});

Deno.test("fim de assinatura cancela só a assinatura", () => {
  for (const evento of ["SUBSCRIPTION_ENDED", "SUBSCRIPTION_DELETED"]) {
    const plano = planejarWebhook(
      evento,
      { signup: signupPendente, assinatura: assinaturaMensal, compra: null },
      AGORA
    );
    assertEquals(plano.statusAssinatura, "canceled", evento);
    assertEquals(plano.statusSignup, null, evento);
  }
});

Deno.test("evento desconhecido não grava nada", () => {
  const plano = planejarWebhook(
    "PAYMENT_CREATED",
    { signup: signupPendente, assinatura: assinaturaMensal, compra: compraPendente },
    AGORA
  );
  assertEquals(plano, {
    marcarSignupPago: false,
    dispararConvite: false,
    definirTrial: false,
    marcarCompraPaga: false,
    creditoTokens: null,
    renovarAssinaturaAte: null,
    encerrarAcessoAgora: false,
    statusAssinatura: null,
    statusSignup: null,
    statusCompra: null,
  });
});

Deno.test("data do pagamento: usa a do Asaas e cai no agora quando ausente", () => {
  assertEquals(dataPagamento("2026-10-05", AGORA), "2026-10-05T00:00:00.000Z");
  assertEquals(dataPagamento(undefined, AGORA), AGORA.toISOString());
  assertEquals(referenciaCompraTokens("x"), "token_pack_purchase:x");
});

Deno.test("fim de assinatura sem estorno mantém o acesso até o fim do período", () => {
  for (const evento of ["SUBSCRIPTION_ENDED", "SUBSCRIPTION_DELETED"]) {
    const plano = planejarWebhook(evento, { signup: null, assinatura: assinaturaMensal, compra: null }, AGORA);
    assertEquals(plano.encerrarAcessoAgora, false, evento);
  }
});
