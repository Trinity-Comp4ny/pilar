import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const obra = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("e-mail é opcional: vazio ou ausente cai na senha manual", () => {
  for (const email of [undefined, "", null]) {
    const r = lerEntrada({ obra_id: obra, nome: "José", email });
    assertEquals(r.ok && r.data.email, undefined);
  }
});

Deno.test("quando vem, o e-mail tem que ser válido", () => {
  assertEquals(lerEntrada({ obra_id: obra, nome: "José", email: "jose@" }), { ok: false, error: "email inválido" });
  const r = lerEntrada({ obra_id: obra, nome: "José", email: " jose@obra.com " });
  assertEquals(r.ok && r.data.email, "jose@obra.com");
});

Deno.test("nome obrigatório e curto; obra precisa ser uuid", () => {
  assertEquals(lerEntrada({ obra_id: obra, nome: "   " }), { ok: false, error: "Informe o nome" });
  assertEquals(lerEntrada({ obra_id: obra, nome: "x".repeat(200) }), { ok: false, error: "Informe o nome" });
  assertEquals(lerEntrada({ obra_id: "1", nome: "José" }), { ok: false, error: "obra_id inválido" });
});
