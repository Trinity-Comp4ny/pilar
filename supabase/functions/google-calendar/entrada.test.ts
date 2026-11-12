import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerAcao } from "./entrada.ts";

Deno.test("Agenda aceita só iniciar, sincronizar e desconectar", () => {
  assertEquals(lerAcao({ acao: "iniciar", retorno: "/gestao/tarefas" }), {
    ok: true,
    data: { acao: "iniciar", retorno: "/gestao/tarefas" },
  });
  assertEquals(lerAcao({ acao: "sincronizar" }), { ok: true, data: { acao: "sincronizar" } });
  assertEquals(lerAcao({ acao: "desconectar" }), { ok: true, data: { acao: "desconectar" } });
  // "cron" só vale com o segredo do cron, nunca pelo corpo de quem está logado.
  assertEquals(lerAcao({ acao: "cron" }).ok, false);
  assertEquals(lerAcao(null).ok, false);
});
