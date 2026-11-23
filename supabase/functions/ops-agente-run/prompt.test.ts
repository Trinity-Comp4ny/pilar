import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { respostaSchema, systemPrompt } from "./prompt.ts";

// Sentry PILAR-58: o modelo devolvia mais de 5 refs por destaque e o schema reprovava.
Deno.test("systemPrompt limita refs de destaque a 5, como o schema", () => {
  for (const agente of ["receita", "clientes", "produto", "qualidade"] as const) {
    assert(systemPrompt(agente, "Fulano").includes("nunca mais de 5"));
  }
});

Deno.test("respostaSchema descarta destaque sem texto e corta refs acima de 5", () => {
  const r = respostaSchema.parse({
    resumo: "ok",
    mensagens: [],
    destaques: [
      { refs: ["a"] },
      { texto: "vale", refs: ["a", "b", "c", "d", "e", "f", "g"] },
    ],
  });
  assertEquals(r.destaques.length, 1);
  assertEquals(r.destaques[0].refs.length, 5);
});
