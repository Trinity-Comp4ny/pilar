// Roda com: deno test --allow-env supabase/functions/_shared
//
// SPEC 098 Fase 2B: cobre as chamadas novas ao Asaas (tokenização sem
// cobrança e estorno) — o contrato HTTP exato (path, método, body) é o que
// mais importa acertar aqui, já que um erro nisso só aparece em produção
// contra o Asaas de verdade.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("ASAAS_PLATFORM_API_KEY", "test-key");
Deno.env.set("ASAAS_PLATFORM_ENV", "sandbox");

const { tokenizeCreditCard, refundPayment, createSubscription } = await import("./asaas-platform.ts");

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => impl(String(input), init)) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const CARD = {
  holderName: "Liz Almendro",
  number: "4111111111111111",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
};
const HOLDER = {
  name: "Liz Almendro",
  email: "liz@vrz.com.br",
  cpfCnpj: "12345678909",
  postalCode: "13330000",
  addressNumber: "100",
};

Deno.test("tokenizeCreditCard: chama o endpoint certo e devolve o token", async () => {
  let capturedUrl = "";
  let capturedBody: unknown;
  const restore = stubFetch((url, init) => {
    capturedUrl = url;
    capturedBody = JSON.parse(String(init?.body));
    return jsonResponse({ creditCardNumber: "1111", creditCardBrand: "VISA", creditCardToken: "tok_abc123" });
  });

  try {
    const result = await tokenizeCreditCard({
      customer: "cus_123",
      creditCard: CARD,
      creditCardHolderInfo: HOLDER,
      remoteIp: "203.0.113.10",
    });

    assertEquals(capturedUrl, "https://sandbox.asaas.com/api/v3/creditCard/tokenizeCreditCard");
    assertEquals((capturedBody as { customer: string }).customer, "cus_123");
    assertEquals((capturedBody as { remoteIp: string }).remoteIp, "203.0.113.10");
    assertEquals(result.creditCardToken, "tok_abc123");
    assertEquals(result.creditCardBrand, "VISA");
  } finally {
    restore();
  }
});

Deno.test("tokenizeCreditCard: cartão recusado pelo Asaas vira erro com a mensagem real", async () => {
  const restore = stubFetch(() => jsonResponse({ errors: [{ description: "Cartão recusado pela operadora" }] }, 400));

  try {
    let threw = false;
    try {
      await tokenizeCreditCard({
        customer: "cus_123",
        creditCard: CARD,
        creditCardHolderInfo: HOLDER,
        remoteIp: "0.0.0.0",
      });
    } catch (err) {
      threw = true;
      assertEquals((err as Error).message, "Asaas: Cartão recusado pela operadora");
    }
    assertEquals(threw, true);
  } finally {
    restore();
  }
});

Deno.test("refundPayment: POST no endpoint de estorno do payment certo", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  const restore = stubFetch((url, init) => {
    capturedUrl = url;
    capturedMethod = init?.method ?? "";
    return jsonResponse({
      id: "pay_1",
      status: "REFUNDED",
      value: 690,
      dueDate: "2026-09-09",
      billingType: "CREDIT_CARD",
    });
  });

  try {
    const result = await refundPayment("pay_1");
    assertEquals(capturedUrl, "https://sandbox.asaas.com/api/v3/payments/pay_1/refund");
    assertEquals(capturedMethod, "POST");
    assertEquals(result.status, "REFUNDED");
  } finally {
    restore();
  }
});

Deno.test(
  "createSubscription: creditCardToken substitui creditCard no corpo (conversão automática do cron)",
  async () => {
    let capturedBody: unknown;
    const restore = stubFetch((_url, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({
        id: "sub_1",
        customer: "cus_123",
        status: "ACTIVE",
        nextDueDate: "2026-09-09",
        value: 690,
        cycle: "MONTHLY",
        billingType: "CREDIT_CARD",
      });
    });

    try {
      await createSubscription({
        customer: "cus_123",
        billingType: "CREDIT_CARD",
        value: 690,
        cycle: "MONTHLY",
        nextDueDate: "2026-09-09",
        creditCardToken: "tok_abc123",
        remoteIp: "0.0.0.0",
      });

      const body = capturedBody as Record<string, unknown>;
      assertEquals(body.creditCardToken, "tok_abc123");
      assertEquals(body.creditCard, undefined);
      assertEquals(body.creditCardHolderInfo, undefined);
    } finally {
      restore();
    }
  }
);
