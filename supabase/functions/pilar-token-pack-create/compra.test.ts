import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { purchaseSchema, statusInicialDaCompra, TIER_CATALOG } from "./compra.ts";

const cartao = {
  holderName: "Fulano Silva",
  number: "4111111111111111",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
};
const titular = {
  name: "Fulano Silva",
  email: "Fulano@Exemplo.com",
  cpfCnpj: "123.456.789-09",
  postalCode: "01310-100",
  addressNumber: "100",
};

Deno.test("catálogo: preço e tokens de cada tier são os decididos em DECISOES.md (2026-09-01)", () => {
  // Mudar um número aqui é mudar preço: o teste existe para isso nunca passar despercebido.
  assertEquals(TIER_CATALOG, {
    starter: { tokens: 500_000, valorCentavos: 4900 },
    cresce: { tokens: 1_500_000, valorCentavos: 12900 },
    escala: { tokens: 3_000_000, valorCentavos: 22800 },
    maximo: { tokens: 6_000_000, valorCentavos: 39900 },
  });
});

Deno.test("cliente não consegue mandar valor nem quantidade de tokens: campos extras somem", () => {
  const r = purchaseSchema.safeParse({
    tier_id: "starter",
    billing_type: "PIX",
    valor_centavos: 1,
    tokens: 999_999_999,
    quantidade_pacotes: 100,
  });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data, { tier_id: "starter", billing_type: "PIX" });
});

Deno.test("tier ou forma de pagamento fora do catálogo é rejeitado", () => {
  assertEquals(purchaseSchema.safeParse({ tier_id: "gratis", billing_type: "PIX" }).success, false);
  assertEquals(purchaseSchema.safeParse({ tier_id: "starter", billing_type: "DINHEIRO" }).success, false);
  assertEquals(purchaseSchema.safeParse({ billing_type: "PIX" }).success, false);
});

Deno.test("cartão exige dados do cartão E do titular", () => {
  assertEquals(purchaseSchema.safeParse({ tier_id: "cresce", billing_type: "CREDIT_CARD" }).success, false);
  assertEquals(
    purchaseSchema.safeParse({ tier_id: "cresce", billing_type: "CREDIT_CARD", credit_card: cartao }).success,
    false
  );
  const ok = purchaseSchema.safeParse({
    tier_id: "cresce",
    billing_type: "CREDIT_CARD",
    credit_card: cartao,
    credit_card_holder_info: titular,
  });
  assertEquals(ok.success, true);
  // Normalização do titular antes de ir pro Asaas.
  if (ok.success) {
    assertEquals(ok.data.credit_card_holder_info?.cpfCnpj, "12345678909");
    assertEquals(ok.data.credit_card_holder_info?.postalCode, "01310100");
    assertEquals(ok.data.credit_card_holder_info?.email, "fulano@exemplo.com");
  }
});

Deno.test("cartão com número inválido é rejeitado antes de chegar no Asaas", () => {
  const r = purchaseSchema.safeParse({
    tier_id: "cresce",
    billing_type: "CREDIT_CARD",
    credit_card: { ...cartao, number: "4111-1111" },
    credit_card_holder_info: titular,
  });
  assertEquals(r.success, false);
});

Deno.test("status inicial: cartão aprovado na hora já nasce pago, o resto espera o webhook", () => {
  assertEquals(statusInicialDaCompra("CONFIRMED"), "paid");
  assertEquals(statusInicialDaCompra("RECEIVED"), "paid");
  assertEquals(statusInicialDaCompra("PENDING"), "pending");
  assertEquals(statusInicialDaCompra("AWAITING_RISK_ANALYSIS"), "pending");
});
