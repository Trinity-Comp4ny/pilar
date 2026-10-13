import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const cliente = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("cliente precisa ser uuid", () => {
  assertEquals(lerEntrada({}), { ok: false, error: "cliente_id inválido" });
  assertEquals(lerEntrada({ cliente_id: "1" }), { ok: false, error: "cliente_id inválido" });
});

Deno.test("nome do cliente vira uma linha curta para o e-mail", () => {
  const r = lerEntrada({ cliente_id: cliente, nome_cliente: "  Ana\n\nSilva\r\nLtda  " });
  assertEquals(r.ok && r.data.nome_cliente, "Ana Silva Ltda");
  const longo = lerEntrada({ cliente_id: cliente, nome_cliente: "a".repeat(500) });
  assertEquals(longo.ok && longo.data.nome_cliente?.length, 200);
});

Deno.test("nome ausente, vazio ou que não é texto fica de fora", () => {
  for (const nome_cliente of [undefined, "", "   ", 42, { x: 1 }]) {
    const r = lerEntrada({ cliente_id: cliente, nome_cliente });
    assertEquals(r.ok && r.data.nome_cliente, undefined);
  }
});
