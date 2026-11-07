import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { AsaasPayment } from "../_shared/asaas-platform.ts";
import { metadataDaCobranca, statusInicialDoSignup, valorDoPlano } from "./regras.ts";

const plano = { preco_mensal: 690, preco_anual: 6900 };

const cobranca: AsaasPayment = {
  id: "pay_1",
  status: "PENDING",
  value: 690,
  dueDate: "2026-11-07",
  billingType: "BOLETO",
  invoiceUrl: "https://asaas/i/pay_1",
  bankSlipUrl: "https://asaas/b/pay_1",
  identificationField: "23790.00000",
  nossoNumero: "123",
};

Deno.test("valor: mensal e anual vêm do plano no banco", () => {
  assertEquals(valorDoPlano(plano, "monthly"), 690);
  assertEquals(valorDoPlano(plano, "yearly"), 6900);
});

Deno.test("valor: plano sem preço, com preço zero ou negativo no ciclo é indisponível", () => {
  assertEquals(valorDoPlano({ ...plano, preco_anual: null }, "yearly"), null);
  assertEquals(valorDoPlano({ ...plano, preco_mensal: 0 }, "monthly"), null);
  assertEquals(valorDoPlano({ ...plano, preco_mensal: -1 }, "monthly"), null);
  // O ciclo que não foi escolhido não importa.
  assertEquals(valorDoPlano({ ...plano, preco_anual: null }, "monthly"), 690);
});

Deno.test("status inicial: só cartão aprovado na hora nasce pago", () => {
  assertEquals(statusInicialDoSignup("CREDIT_CARD", "CONFIRMED"), "paid");
  assertEquals(statusInicialDoSignup("CREDIT_CARD", "RECEIVED"), "paid");
});

Deno.test("status inicial: cartão em análise, sem cobrança, PIX e boleto esperam o webhook", () => {
  assertEquals(statusInicialDoSignup("CREDIT_CARD", "PENDING"), "pending");
  assertEquals(statusInicialDoSignup("CREDIT_CARD", "AWAITING_RISK_ANALYSIS"), "pending");
  assertEquals(statusInicialDoSignup("CREDIT_CARD", undefined), "pending");
  // PIX confirmado no instante da criação ainda passa pelo webhook/polling, não nasce pago.
  assertEquals(statusInicialDoSignup("PIX", "RECEIVED"), "pending");
  assertEquals(statusInicialDoSignup("BOLETO", "CONFIRMED"), "pending");
});

Deno.test("metadata do boleto traz linha digitável, link e nosso número", () => {
  assertEquals(metadataDaCobranca("BOLETO", 690, "monthly", cobranca), {
    billing_type: "BOLETO",
    value: 690,
    cycle: "monthly",
    payment_id: "pay_1",
    invoice_url: "https://asaas/i/pay_1",
    boleto: {
      bank_slip_url: "https://asaas/b/pay_1",
      identification_field: "23790.00000",
      nosso_numero: "123",
    },
  });
});

Deno.test("metadata de boleto sem os campos do Asaas usa null, não undefined", () => {
  const m = metadataDaCobranca("BOLETO", 690, "monthly", {
    ...cobranca,
    bankSlipUrl: undefined,
    nossoNumero: undefined,
  });
  assertEquals(m.boleto, { bank_slip_url: null, identification_field: "23790.00000", nosso_numero: null });
});

Deno.test("metadata de PIX e cartão não leva bloco de boleto", () => {
  assertEquals("boleto" in metadataDaCobranca("PIX", 690, "monthly", cobranca), false);
  assertEquals("boleto" in metadataDaCobranca("CREDIT_CARD", 6900, "yearly", cobranca), false);
});

Deno.test("metadata sem 1ª cobrança (Asaas não devolveu) não quebra: ids nulos e sem boleto", () => {
  assertEquals(metadataDaCobranca("BOLETO", 690, "monthly", null), {
    billing_type: "BOLETO",
    value: 690,
    cycle: "monthly",
    payment_id: null,
    invoice_url: null,
  });
});
