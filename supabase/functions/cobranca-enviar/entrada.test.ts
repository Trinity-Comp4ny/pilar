import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_ABERTURA } from "./entrada.ts";

const id = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("envio de cobrança exige a cobrança como uuid", () => {
  assertEquals(lerEntrada({ cobranca_id: id }).ok, true);
  assertEquals(lerEntrada({ cobranca_id: 10 }), { ok: false, error: "cobranca_id inválido" });
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
});

Deno.test("abertura editada é opcional, aparada e limitada", () => {
  assertEquals(lerEntrada({ cobranca_id: id, abertura: "  Olá  " }), {
    ok: true,
    data: { cobranca_id: id, abertura: "Olá" },
  });
  assertEquals(lerEntrada({ cobranca_id: id, abertura: "   " }).ok, false);
  assertEquals(lerEntrada({ cobranca_id: id, abertura: "x".repeat(MAX_ABERTURA + 1) }).ok, false);
});
