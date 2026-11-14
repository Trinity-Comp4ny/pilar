import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { systemPrompt } from "./prompt.ts";

// Sentry PILAR-58: o modelo devolvia mais de 5 refs por destaque e o schema reprovava.
Deno.test("systemPrompt limita refs de destaque a 5, como o schema", () => {
  for (const agente of ["receita", "clientes", "produto", "qualidade"] as const) {
    assert(systemPrompt(agente, "Fulano").includes("nunca mais de 5"));
  }
});
