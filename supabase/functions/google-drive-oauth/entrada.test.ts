import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerAcao } from "./entrada.ts";

Deno.test("OAuth do Drive aceita só iniciar e desconectar", () => {
  assertEquals(lerAcao({ acao: "iniciar", retorno: "/projetos" }), {
    ok: true,
    data: { acao: "iniciar", retorno: "/projetos" },
  });
  assertEquals(lerAcao({ acao: "desconectar" }), { ok: true, data: { acao: "desconectar" } });
  assertEquals(lerAcao({ acao: "apagar_tudo" }).ok, false);
  assertEquals(lerAcao(null), { ok: false, error: "Corpo da requisição inválido" });
});
