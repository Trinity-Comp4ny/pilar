import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decidirReverificacao } from "./decisao.ts";

const info = (situacaoCadastral: string) => ({ razaoSocial: "X Ltda", situacaoCadastral, cnaePrincipal: null });

Deno.test("API fora do ar: continua pendente para amanhã", () => {
  assertEquals(decidirReverificacao({ status: "indisponivel" }), "aguardar");
});

Deno.test("ATIVA verifica; qualquer outra situação recusa", () => {
  assertEquals(decidirReverificacao({ status: "ok", info: info("ATIVA") }), "verificar");
  for (const s of ["BAIXADA", "INAPTA", "SUSPENSA", "NULA"]) {
    assertEquals(decidirReverificacao({ status: "ok", info: info(s) }), "recusar", s);
  }
});
