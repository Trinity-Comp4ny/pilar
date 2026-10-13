import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const entrega = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita link público (token) ou sessão do portal", () => {
  const publico = lerEntrada({ entrega_id: entrega, token: "abc" });
  assertEquals(publico.ok && publico.data.token, "abc");
  const sessao = lerEntrada({ entrega_id: entrega, session_token: "s" });
  assertEquals(sessao.ok && sessao.data.session_token, "s");
});

Deno.test("exige ao menos uma credencial", () => {
  assertEquals(lerEntrada({ entrega_id: entrega }), { ok: false, error: "token ou session_token obrigatório" });
  assertEquals(lerEntrada({ entrega_id: entrega, token: "", session_token: 42 }), {
    ok: false,
    error: "token ou session_token obrigatório",
  });
});

Deno.test("entrega precisa ser uuid", () => {
  assertEquals(lerEntrada({ entrega_id: "../x", token: "abc" }), { ok: false, error: "entrega_id inválido" });
});
