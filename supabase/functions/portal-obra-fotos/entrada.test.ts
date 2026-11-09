import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_FOTOS, MAX_REGISTROS } from "./entrada.ts";

const foto = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita sessão e lista de fotos", () => {
  const r = lerEntrada({ session_token: "s", foto_ids: [foto] });
  assertEquals(r.ok && r.data.foto_ids, [foto]);
});

Deno.test("sem foto nem registro: foto_ids obrigatório", () => {
  assertEquals(lerEntrada({ session_token: "s" }), { ok: false, error: "foto_ids obrigatório" });
  assertEquals(lerEntrada({ session_token: "s", foto_ids: [] }), { ok: false, error: "foto_ids obrigatório" });
  assertEquals(lerEntrada({ session_token: "s", foto_ids: [], registro_ids: [] }), {
    ok: false,
    error: "foto_ids obrigatório",
  });
});

Deno.test("lista que não é lista: inválida", () => {
  assertEquals(lerEntrada({ session_token: "s", foto_ids: "abc" }), { ok: false, error: "foto_ids inválido" });
  assertEquals(lerEntrada({ session_token: "s", registro_ids: "abc" }), { ok: false, error: "registro_ids inválido" });
});

Deno.test("só registros também vale", () => {
  const r = lerEntrada({ session_token: "s", registro_ids: [foto] });
  assertEquals(r.ok && [r.data.foto_ids, r.data.registro_ids], [[], [foto]]);
});

Deno.test("registro_ids grande demais ou com id inválido: registro_ids inválido", () => {
  const muitos = Array.from({ length: MAX_REGISTROS + 1 }, () => foto);
  assertEquals(lerEntrada({ session_token: "s", registro_ids: muitos }), { ok: false, error: "registro_ids inválido" });
  assertEquals(lerEntrada({ session_token: "s", registro_ids: ["x"] }), { ok: false, error: "registro_ids inválido" });
});

Deno.test("lista grande demais ou com id inválido: foto_ids inválido", () => {
  const muitas = Array.from({ length: MAX_FOTOS + 1 }, () => foto);
  assertEquals(lerEntrada({ session_token: "s", foto_ids: muitas }), { ok: false, error: "foto_ids inválido" });
  assertEquals(lerEntrada({ session_token: "s", foto_ids: [foto, "x"] }), { ok: false, error: "foto_ids inválido" });
});

Deno.test("sem sessão: session_token obrigatório", () => {
  assertEquals(lerEntrada({ foto_ids: [foto] }), { ok: false, error: "session_token obrigatório" });
});
