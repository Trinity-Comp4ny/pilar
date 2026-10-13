import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const receita = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita PIX e BOLETO para uma receita", () => {
  for (const billing_type of ["PIX", "BOLETO"] as const) {
    const r = lerEntrada({ receita_id: receita, billing_type });
    assertEquals(r.ok && r.data, { receita_id: receita, billing_type });
  }
});

Deno.test("recusa forma de pagamento fora da lista", () => {
  const r = lerEntrada({ receita_id: receita, billing_type: "CREDIT_CARD" });
  assertEquals(!r.ok && r.error, "billing_type: billing_type deve ser PIX ou BOLETO");
});

Deno.test("recusa receita que não é uuid antes de chegar ao banco", () => {
  assertEquals(lerEntrada({ receita_id: "1 or 1=1", billing_type: "PIX" }).ok, false);
  assertEquals(lerEntrada({ billing_type: "PIX" }).ok, false);
  assertEquals(lerEntrada(null).ok, false);
});
