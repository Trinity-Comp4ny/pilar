import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, tipoDoRegistro } from "./entrada.ts";

const base = { obra_id: crypto.randomUUID(), client_id: crypto.randomUUID(), data: "2026-10-20" };

Deno.test("aceita só texto", () => {
  assertEquals(lerEntrada({ ...base, texto: "Chuva à tarde" }).ok, true);
});

Deno.test("aceita áudio com foto", () => {
  const r = lerEntrada({
    ...base,
    audio: { mime_type: "audio/webm", base64: "AAAA", duracao_s: 48 },
    fotos: [{ content_type: "image/jpeg", image_base64: "AAAA" }],
  });
  assertEquals(r.ok, true);
});

Deno.test("registro vazio é recusado", () => {
  assertEquals(lerEntrada(base), { ok: false, error: "Registro vazio" });
  assertEquals(lerEntrada({ ...base, texto: "  " }), { ok: false, error: "Registro vazio" });
});

Deno.test("obra_id e data inválidos são recusados", () => {
  assertEquals(lerEntrada({ ...base, obra_id: "x", texto: "a" }), { ok: false, error: "obra_id inválido" });
  assertEquals(lerEntrada({ ...base, data: "20/10/2026", texto: "a" }), { ok: false, error: "data inválida" });
});

Deno.test("áudio acima de 3 minutos (com a folga de 5 s) é recusado", () => {
  const audio = (s: number) => ({ mime_type: "audio/webm", base64: "AAAA", duracao_s: s });
  assertEquals(lerEntrada({ ...base, audio: audio(186) }), { ok: false, error: "Áudio acima de 3 minutos" });
  assertEquals(lerEntrada({ ...base, audio: audio(183) }).ok, true);
});

Deno.test("mais de 6 fotos é recusado", () => {
  const f = { content_type: "image/jpeg", image_base64: "AAAA" };
  assertEquals(lerEntrada({ ...base, fotos: Array(7).fill(f) }), {
    ok: false,
    error: "No máximo 6 fotos por registro",
  });
});

Deno.test("o tipo segue o que o registro tem", () => {
  const audio = { mime_type: "audio/webm" as const, base64: "A", duracao_s: 1 };
  const foto = { content_type: "image/jpeg" as const, image_base64: "A" };
  assertEquals(tipoDoRegistro({ audio, fotos: [] }), "audio");
  assertEquals(tipoDoRegistro({ texto: "a", fotos: [] }), "texto");
  assertEquals(tipoDoRegistro({ fotos: [foto] }), "foto");
  assertEquals(tipoDoRegistro({ texto: "a", fotos: [foto] }), "misto");
  assertEquals(tipoDoRegistro({ audio, texto: "a", fotos: [] }), "misto");
});
