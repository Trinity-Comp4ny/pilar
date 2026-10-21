import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const obra = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita sessão e obra", () => {
  const r = lerEntrada({ session_token: "s", obra_id: obra });
  assertEquals(r.ok && r.data.obra_id, obra);
});

Deno.test("sem sessão: session_token obrigatório", () => {
  assertEquals(lerEntrada({ obra_id: obra }), { ok: false, error: "session_token obrigatório" });
});

Deno.test("obra ausente ou inválida: obra_id inválido", () => {
  assertEquals(lerEntrada({ session_token: "s" }), { ok: false, error: "obra_id inválido" });
  assertEquals(lerEntrada({ session_token: "s", obra_id: "x" }), { ok: false, error: "obra_id inválido" });
});

Deno.test("corpo que não é objeto é recusado", () => {
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
});
