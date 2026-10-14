import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { tokenDaSessao } from "./entrada.ts";

const token = "a".repeat(32);

Deno.test("aceita token de sessão com tamanho de token gerado", () => {
  assertEquals(tokenDaSessao(token), token);
  assertEquals(tokenDaSessao(`  ${token}  `), token);
});

Deno.test("recusa o que não é texto ou tem tamanho fora do esperado", () => {
  assertEquals(tokenDaSessao(undefined), null);
  assertEquals(tokenDaSessao(null), null);
  assertEquals(tokenDaSessao(1234567890), null);
  assertEquals(tokenDaSessao({ length: 40 }), null);
  assertEquals(tokenDaSessao("curto"), null);
  assertEquals(tokenDaSessao("a".repeat(201)), null);
});
