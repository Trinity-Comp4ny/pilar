import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

Deno.test("aceita registro_id sozinho (escritório) e com token (campo)", () => {
  const id = crypto.randomUUID();
  assertEquals(lerEntrada({ registro_id: id }).ok, true);
  assertEquals(lerEntrada({ registro_id: id, token: "abc" }).ok, true);
});

Deno.test("registro_id inválido e corpo que não é objeto", () => {
  assertEquals(lerEntrada({ registro_id: "x" }), { ok: false, error: "registro_id inválido" });
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
});
