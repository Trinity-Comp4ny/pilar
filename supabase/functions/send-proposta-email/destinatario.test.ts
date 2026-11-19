import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { destinatarioPermitido } from "./destinatario.ts";

Deno.test("aceita o e-mail cadastrado, ignorando caixa e espaços", () => {
  assertEquals(destinatarioPermitido("Cliente@Empresa.com", " cliente@empresa.com "), true);
});

Deno.test("recusa e-mail diferente do cadastrado", () => {
  assertEquals(destinatarioPermitido("cliente@empresa.com", "outro@spam.com"), false);
});

Deno.test("sem e-mail no cadastro, aceita o digitado", () => {
  assertEquals(destinatarioPermitido(null, "novo@cliente.com"), true);
  assertEquals(destinatarioPermitido("  ", "novo@cliente.com"), true);
});
