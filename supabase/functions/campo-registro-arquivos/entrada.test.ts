import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ehDoDono, lerEntrada } from "./entrada.ts";

const id = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita token e registro", () => {
  const r = lerEntrada({ token: "t", registro_id: id });
  assertEquals(r.ok && r.data.registro_id, id);
});

Deno.test("sem token ou com registro inválido é recusado", () => {
  assertEquals(lerEntrada({ registro_id: id }), { ok: false, error: "token ausente" });
  assertEquals(lerEntrada({ token: "t", registro_id: "x" }), { ok: false, error: "registro_id inválido" });
});

Deno.test("só o dono, na própria obra, abre os arquivos", () => {
  const sessao = { account_id: "a1", obra_id: "o1" };
  assertEquals(ehDoDono(sessao, { obra_id: "o1", autor_campo_account_id: "a1" }), true);
  assertEquals(ehDoDono(sessao, { obra_id: "o1", autor_campo_account_id: "a2" }), false);
  assertEquals(ehDoDono(sessao, { obra_id: "o2", autor_campo_account_id: "a1" }), false);
  assertEquals(ehDoDono(sessao, { obra_id: "o1", autor_campo_account_id: null }), false);
  assertEquals(ehDoDono({}, { obra_id: "o1", autor_campo_account_id: null }), false);
});
