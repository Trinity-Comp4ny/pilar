import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { autorizarWebhook } from "./autorizacao.ts";

const SEGREDO = "whsec_pilar_123";

Deno.test("token igual ao configurado passa", () => {
  assertEquals(autorizarWebhook(SEGREDO, SEGREDO), "ok");
});

Deno.test("sem token, token errado, prefixo ou token com espaço são recusados", () => {
  assertEquals(autorizarWebhook(null, SEGREDO), "nao_autorizado");
  assertEquals(autorizarWebhook("", SEGREDO), "nao_autorizado");
  assertEquals(autorizarWebhook("whsec_pilar_124", SEGREDO), "nao_autorizado");
  assertEquals(autorizarWebhook("whsec_pilar", SEGREDO), "nao_autorizado");
  assertEquals(autorizarWebhook(`${SEGREDO} `, SEGREDO), "nao_autorizado");
  assertEquals(autorizarWebhook(SEGREDO.toUpperCase(), SEGREDO), "nao_autorizado");
});

Deno.test("segredo não configurado recusa tudo, inclusive chamada sem token (nunca aceita aberto)", () => {
  assertEquals(autorizarWebhook(null, undefined), "sem_configuracao");
  assertEquals(autorizarWebhook("", ""), "sem_configuracao");
  assertEquals(autorizarWebhook("qualquer", undefined), "sem_configuracao");
});
