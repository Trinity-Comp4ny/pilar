import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { cronAutorizado } from "./cron-auth.ts";

const h = (auth?: string) => new Headers(auth === undefined ? {} : { Authorization: auth });

Deno.test("aceita o Bearer com o segredo exato", () => {
  assertEquals(cronAutorizado(h("Bearer s3gredo"), "s3gredo"), true);
  assertEquals(cronAutorizado(h("bearer s3gredo"), "s3gredo"), true);
});

Deno.test("recusa segredo errado, prefixo e ausência", () => {
  assertEquals(cronAutorizado(h("Bearer s3gred"), "s3gredo"), false);
  assertEquals(cronAutorizado(h("Bearer s3gredoX"), "s3gredo"), false);
  assertEquals(cronAutorizado(h(), "s3gredo"), false);
});

Deno.test("segredo não configurado nunca autoriza", () => {
  assertEquals(cronAutorizado(h("Bearer "), ""), false);
  assertEquals(cronAutorizado(h(), ""), false);
});
