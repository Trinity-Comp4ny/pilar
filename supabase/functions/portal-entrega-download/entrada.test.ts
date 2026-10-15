import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const entrega = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita a sessão do portal", () => {
  const sessao = lerEntrada({ entrega_id: entrega, session_token: "s" });
  assertEquals(sessao.ok && sessao.data.session_token, "s");
});

Deno.test("exige a sessão do portal", () => {
  assertEquals(lerEntrada({ entrega_id: entrega }), { ok: false, error: "session_token obrigatório" });
  assertEquals(lerEntrada({ entrega_id: entrega, session_token: "" }), {
    ok: false,
    error: "session_token obrigatório",
  });
  assertEquals(lerEntrada({ entrega_id: entrega, session_token: 42 }), {
    ok: false,
    error: "session_token obrigatório",
  });
});

Deno.test("o link público por token não é mais aceito", () => {
  assertEquals(lerEntrada({ entrega_id: entrega, token: "abc" }), { ok: false, error: "session_token obrigatório" });
});

Deno.test("entrega precisa ser uuid", () => {
  assertEquals(lerEntrada({ entrega_id: "../x", session_token: "s" }), { ok: false, error: "entrega_id inválido" });
});
