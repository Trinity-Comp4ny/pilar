import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

Deno.test("lembrete exige receita como uuid", () => {
  assertEquals(lerEntrada({ receita_id: "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00" }).ok, true);
  assertEquals(lerEntrada({ receita_id: 10 }), { ok: false, error: "receita_id inválido" });
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
});
