import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { aprovado, formularioVerificacao, tokenTurnstile } from "./entrada.ts";

Deno.test("token do widget: texto até 2048 caracteres", () => {
  assertEquals(tokenTurnstile({ token: "abc" }), "abc");
  assertEquals(tokenTurnstile({ token: "" }), null);
  assertEquals(tokenTurnstile({ token: 1 }), null);
  assertEquals(tokenTurnstile({ token: "x".repeat(2049) }), null);
  assertEquals(tokenTurnstile(null), null);
});

Deno.test("formulário do siteverify só leva o IP quando há IP", () => {
  assertEquals(formularioVerificacao("s", "t", "").toString(), "secret=s&response=t");
  assertEquals(formularioVerificacao("s", "t", "1.2.3.4").get("remoteip"), "1.2.3.4");
});

Deno.test("só success === true aprova", () => {
  assertEquals(aprovado({ success: true }), true);
  for (const r of [{ success: "true" }, { success: false }, {}, null, "ok"]) assertEquals(aprovado(r), false);
});
