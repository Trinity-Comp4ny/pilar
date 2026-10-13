import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { chamadorAutorizado, lerEntrada, segredoConfere } from "./entrada.ts";

const segredos = { serviceRoleKey: "service-key", sharedSecret: "shared-secret" };
const h = (init: Record<string, string>) => new Headers(init);

Deno.test("aceita service role ou segredo compartilhado", () => {
  assertEquals(chamadorAutorizado(h({ Authorization: "Bearer service-key" }), segredos), true);
  assertEquals(chamadorAutorizado(h({ "x-pilar-secret": "shared-secret" }), segredos), true);
});

Deno.test("recusa chave errada, prefixo da chave e ausência", () => {
  assertEquals(chamadorAutorizado(h({ Authorization: "Bearer service-ke" }), segredos), false);
  assertEquals(chamadorAutorizado(h({ "x-pilar-secret": "shared-secretX" }), segredos), false);
  assertEquals(chamadorAutorizado(h({}), segredos), false);
});

Deno.test("segredo não configurado nunca autoriza, nem com header vazio", () => {
  assertEquals(chamadorAutorizado(h({ "x-pilar-secret": "" }), { serviceRoleKey: "", sharedSecret: "" }), false);
  assertEquals(segredoConfere("", ""), false);
});

Deno.test("request_id precisa ser uuid", () => {
  assertEquals(lerEntrada({ request_id: "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00" }).ok, true);
  assertEquals(lerEntrada({ request_id: "1" }), { ok: false, error: "request_id inválido" });
});

Deno.test("tipo: exclusão por padrão (trigger antigo), exportação quando pedido", () => {
  const id = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";
  const padrao = lerEntrada({ request_id: id });
  assertEquals(padrao.ok && padrao.data.tipo, "exclusao");
  const exportacao = lerEntrada({ request_id: id, tipo: "exportacao" });
  assertEquals(exportacao.ok && exportacao.data.tipo, "exportacao");
  assertEquals(lerEntrada({ request_id: id, tipo: "outro" }).ok, false);
});
