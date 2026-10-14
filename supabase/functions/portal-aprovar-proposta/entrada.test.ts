import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const projeto = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";

Deno.test("aceita token de sessão e projeto", () => {
  const r = lerEntrada({ token: "tok", projeto_id: projeto });
  assertEquals(r.ok && r.data, { token: "tok", projeto_id: projeto });
});

Deno.test("mantém as mensagens que o portal já mostrava", () => {
  assertEquals(lerEntrada({ projeto_id: projeto }), { ok: false, error: "token obrigatório" });
  assertEquals(lerEntrada({ token: 123, projeto_id: projeto }), { ok: false, error: "token obrigatório" });
  assertEquals(lerEntrada({ token: "tok", projeto_id: "abc" }), { ok: false, error: "projeto_id inválido" });
});

Deno.test("JSON inválido ou corpo que não é objeto vira 400 claro", () => {
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
  assertEquals(lerEntrada([projeto]), { ok: false, error: "Corpo da requisição inválido" });
});

Deno.test("token absurdo é recusado antes do banco", () => {
  assertEquals(lerEntrada({ token: "x".repeat(600), projeto_id: projeto }).ok, false);
});
