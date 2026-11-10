import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { AVISOS_LEGAIS, chaveIdempotencia, destinatarios, lerEntrada } from "./avisos.ts";

const base = { first_name: "Ana", desativado_em: null };

Deno.test("só admin ativo com e-mail real recebe", () => {
  const r = destinatarios([
    { ...base, id: "1", email: "ana@escritorio.com.br", role: "admin" },
    { ...base, id: "2", email: "membro@escritorio.com.br", role: "colaborador" },
    { ...base, id: "3", email: "saiu@escritorio.com.br", role: "admin", desativado_em: "2026-11-01" },
    { ...base, id: "4", email: "removido-4@usuarios.pilarsoft.invalid", role: "admin" },
    { ...base, id: "5", email: null, role: "admin" },
  ]);
  assertEquals(
    r.map((p) => p.id),
    ["1"]
  );
});

Deno.test("chave de idempotência por aviso e pessoa", () => {
  assertEquals(chaveIdempotencia("termos-2.0", "u1"), "aviso-legal-termos-2.0-u1");
  assert(chaveIdempotencia("termos-2.0", "u1") !== chaveIdempotencia("termos-3.0", "u1"));
});

Deno.test("entrada só aceita aviso do catálogo e modo conhecido", () => {
  assertEquals(lerEntrada({ aviso: "termos-2.0", modo: "simular" }).ok, true);
  assertEquals(lerEntrada({ aviso: "texto livre", modo: "enviar" }).ok, false);
  assertEquals(lerEntrada({ aviso: "termos-2.0", modo: "apagar" }).ok, false);
  assertEquals(lerEntrada(null).ok, false);
});

Deno.test("catálogo: termos 2.0 vale em 10 de dezembro e aponta para /termos", () => {
  const a = AVISOS_LEGAIS["termos-2.0"];
  assertEquals(a.vigencia, "10 de dezembro de 2026");
  assertEquals(a.caminho, "/termos");
  assert(a.itens.length > 0);
});
