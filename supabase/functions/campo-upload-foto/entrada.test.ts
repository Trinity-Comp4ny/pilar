import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decodificarImagem, lerEntrada, MAX_BYTES } from "./entrada.ts";

const rdo = "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00";
const valido = { token: "t", rdo_id: rdo, content_type: "image/jpeg", image_base64: btoa("jpeg") };

Deno.test("aceita foto de tipo conhecido", () => {
  assertEquals(lerEntrada(valido).ok, true);
});

Deno.test("mantém as mensagens que o app de campo já mostrava", () => {
  assertEquals(lerEntrada({ ...valido, token: "" }), { ok: false, error: "token ausente" });
  assertEquals(lerEntrada({ ...valido, rdo_id: "x" }), { ok: false, error: "rdo_id inválido" });
  assertEquals(lerEntrada({ ...valido, content_type: "image/gif" }), {
    ok: false,
    error: "Tipo de imagem não suportado",
  });
  assertEquals(lerEntrada({ ...valido, image_base64: undefined }), { ok: false, error: "imagem ausente" });
});

Deno.test("decodifica base64 válido", () => {
  const r = decodificarImagem(btoa("abc"));
  assertEquals(r.ok && Array.from(r.bytes), [97, 98, 99]);
});

Deno.test("base64 malformado vira 400, não erro de runtime", () => {
  assertEquals(decodificarImagem("@@@não é base64@@@"), { ok: false, status: 400, erro: "imagem inválida" });
});

Deno.test("foto acima de 8MB é recusada antes de decodificar", () => {
  const grande = "A".repeat(Math.ceil((MAX_BYTES * 4) / 3) + 8);
  assertEquals(decodificarImagem(grande), { ok: false, status: 413, erro: "Imagem maior que 8MB" });
});
