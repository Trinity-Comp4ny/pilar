import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { propostaLinkSchema } from "./entrada.ts";

const token = "61693ede-0e88-41fd-98cd-4ad49754ab06";

Deno.test("aceita abrir ou aceitar com um UUID v4", () => {
  for (const acao of ["abrir", "aceitar"]) {
    assertEquals(propostaLinkSchema.parse({ token, acao }), { token, acao });
  }
});

Deno.test("rejeita link ausente, token inválido e ação desconhecida", () => {
  for (const entrada of [
    null,
    [],
    { acao: "abrir" },
    { token: "61693ede-0e88-11fd-98cd-4ad49754ab06", acao: "abrir" },
    { token, acao: "editar" },
  ]) {
    assertEquals(propostaLinkSchema.safeParse(entrada).success, false);
  }
});
