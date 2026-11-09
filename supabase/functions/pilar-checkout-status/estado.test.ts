import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { deveConsultarAsaas, deveEnviarConvite, pagamentoConfirmado, pagoEm } from "./estado.ts";

const AGORA = new Date("2026-11-07T12:00:00.000Z");

Deno.test("cobrança confirmada ou recebida libera; qualquer outro status do Asaas não", () => {
  assertEquals(pagamentoConfirmado("CONFIRMED"), true);
  assertEquals(pagamentoConfirmado("RECEIVED"), true);
  for (const status of ["PENDING", "OVERDUE", "REFUNDED", "AWAITING_RISK_ANALYSIS", "RECEIVED_IN_CASH", ""]) {
    assertEquals(pagamentoConfirmado(status), false, status);
  }
});

Deno.test("consulta o Asaas só com signup pendente e cobrança já criada", () => {
  assertEquals(deveConsultarAsaas({ payment_status: "pending", asaas_payment_id: "pay_1" }), true);
  // Checkout que falhou antes de criar a cobrança: nada a consultar.
  assertEquals(deveConsultarAsaas({ payment_status: "pending", asaas_payment_id: null }), false);
  // Já resolvido: não gasta chamada ao Asaas a cada polling.
  for (const status of ["paid", "failed", "canceled"]) {
    assertEquals(deveConsultarAsaas({ payment_status: status, asaas_payment_id: "pay_1" }), false, status);
  }
});

Deno.test("convite de fallback sai só para signup pago que ainda não recebeu convite", () => {
  assertEquals(deveEnviarConvite({ payment_status: "paid", invite_dispatched_at: null }), true);
  // Polling repetido depois do convite não reenvia (idempotência do fallback).
  assertEquals(deveEnviarConvite({ payment_status: "paid", invite_dispatched_at: "2026-11-07T10:00:00Z" }), false);
  for (const status of ["pending", "failed", "canceled"]) {
    assertEquals(deveEnviarConvite({ payment_status: status, invite_dispatched_at: null }), false, status);
  }
});

Deno.test("data do pagamento: usa a do Asaas e cai no agora quando ausente", () => {
  assertEquals(pagoEm("2026-11-05", AGORA), "2026-11-05T00:00:00.000Z");
  assertEquals(pagoEm(undefined, AGORA), AGORA.toISOString());
  assertEquals(pagoEm("", AGORA), AGORA.toISOString());
});
