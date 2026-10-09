import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createLogger, ehContextoSimples } from "./logger.ts";

Deno.test("ehContextoSimples: objeto literal sim; Error, array, null e string não", () => {
  assertEquals(ehContextoSimples({ empresaId: "x" }), true);
  assertEquals(ehContextoSimples(new Error("x")), false);
  assertEquals(ehContextoSimples([1]), false);
  assertEquals(ehContextoSimples(null), false);
  assertEquals(ehContextoSimples("x"), false);
});

Deno.test("log.error com contexto no lugar do erro registra o contexto, não [object Object]", () => {
  const linhas: string[] = [];
  const original = console.error;
  console.error = (l: string) => linhas.push(l);
  try {
    createLogger("teste").error("tokenização recusada", { error: "Asaas: sem permissão" });
  } finally {
    console.error = original;
  }
  const entry = JSON.parse(linhas[0]);
  assertEquals(entry.error, "Asaas: sem permissão");
  assertEquals(JSON.stringify(entry).includes("[object Object]"), false);
});
