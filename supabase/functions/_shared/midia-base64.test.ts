import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decodificarBase64 } from "./midia-base64.ts";

Deno.test("decodifica base64 válido", () => {
  const r = decodificarBase64(btoa("abc"), 10, "áudio");
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(Array.from(r.bytes), [97, 98, 99]);
});

Deno.test("recusa maior que o teto sem decodificar (413)", () => {
  const r = decodificarBase64("A".repeat(400), 100, "áudio");
  assertEquals(r, { ok: false, status: 413, erro: "áudio grande demais" });
});

Deno.test("base64 malformado e vazio viram 400", () => {
  assertEquals(decodificarBase64("%%%", 10, "foto"), { ok: false, status: 400, erro: "foto inválido" });
  assertEquals(decodificarBase64("", 10, "foto"), { ok: false, status: 400, erro: "foto vazio" });
});
