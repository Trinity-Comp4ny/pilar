import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const cliente = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("convite exige cliente da empresa e e-mail válido", () => {
  const r = lerEntrada({ cliente_id: cliente, email: "ana@cliente.com.br" });
  assertEquals(r.ok && r.data, { cliente_id: cliente, email: "ana@cliente.com.br" });
  assertEquals(lerEntrada({ cliente_id: cliente }), { ok: false, error: "email inválido" });
  assertEquals(lerEntrada({ cliente_id: cliente, email: "ana" }), { ok: false, error: "email inválido" });
  assertEquals(lerEntrada({ cliente_id: "x", email: "ana@cliente.com.br" }), {
    ok: false,
    error: "cliente_id inválido",
  });
});
