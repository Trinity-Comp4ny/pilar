import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

Deno.test("start e stop com o papel visto", () => {
  assertEquals(lerEntrada({ action: "start", viewAsRole: "coordenador" }).ok, true);
  assertEquals(lerEntrada({ action: "stop", viewAsRole: "admin" }).ok, true);
});

Deno.test("ação e papel fora do formato são recusados", () => {
  assertEquals(lerEntrada({ action: "pause", viewAsRole: "user" }), {
    ok: false,
    error: "action deve ser 'start' ou 'stop'",
  });
  assertEquals(lerEntrada({ action: "start" }), { ok: false, error: "viewAsRole obrigatório" });
  assertEquals(lerEntrada({ action: "start", viewAsRole: "admin'; drop" }), {
    ok: false,
    error: "viewAsRole obrigatório",
  });
});
