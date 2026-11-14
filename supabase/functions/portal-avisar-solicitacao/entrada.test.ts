import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

Deno.test("aviso exige o id da solicitação", () => {
  const id = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";
  const r = lerEntrada({ entrega_id: id });
  assertEquals(r.ok && r.data.entrega_id, id);
  assertEquals(lerEntrada({}), { ok: false, error: "entrega_id inválido" });
  assertEquals(lerEntrada({ entrega_id: "x" }), { ok: false, error: "entrega_id inválido" });
});
