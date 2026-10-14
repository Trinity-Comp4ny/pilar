import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_FOTOS } from "./entrada.ts";

const foto = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita sessão e lista de fotos", () => {
  const r = lerEntrada({ session_token: "s", foto_ids: [foto] });
  assertEquals(r.ok && r.data.foto_ids, [foto]);
});

Deno.test("lista ausente ou vazia: foto_ids obrigatório", () => {
  assertEquals(lerEntrada({ session_token: "s" }), { ok: false, error: "foto_ids obrigatório" });
  assertEquals(lerEntrada({ session_token: "s", foto_ids: [] }), { ok: false, error: "foto_ids obrigatório" });
  assertEquals(lerEntrada({ session_token: "s", foto_ids: "abc" }), { ok: false, error: "foto_ids obrigatório" });
});

Deno.test("lista grande demais ou com id inválido: foto_ids inválido", () => {
  const muitas = Array.from({ length: MAX_FOTOS + 1 }, () => foto);
  assertEquals(lerEntrada({ session_token: "s", foto_ids: muitas }), { ok: false, error: "foto_ids inválido" });
  assertEquals(lerEntrada({ session_token: "s", foto_ids: [foto, "x"] }), { ok: false, error: "foto_ids inválido" });
});

Deno.test("sem sessão: session_token obrigatório", () => {
  assertEquals(lerEntrada({ foto_ids: [foto] }), { ok: false, error: "session_token obrigatório" });
});
