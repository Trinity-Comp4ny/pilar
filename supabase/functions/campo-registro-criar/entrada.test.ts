import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";

const base = { token: "t", client_id: crypto.randomUUID(), data: "2026-10-19" };

Deno.test("aceita só texto", () => {
  const r = lerEntrada({ ...base, texto: "Chuva à tarde" });
  assertEquals(r.ok, true);
});

Deno.test("aceita áudio com foto e aceite", () => {
  const r = lerEntrada({
    ...base,
    audio: { mime_type: "audio/webm", base64: "AAAA", duracao_s: 48 },
    fotos: [{ content_type: "image/jpeg", image_base64: "AAAA" }],
    aceite_audio: true,
  });
  assertEquals(r.ok, true);
});

Deno.test("registro vazio é recusado", () => {
  assertEquals(lerEntrada(base), { ok: false, error: "Registro vazio" });
  assertEquals(lerEntrada({ ...base, texto: "   " }), { ok: false, error: "Registro vazio" });
});

Deno.test("áudio acima de 3 minutos (com a folga de 5 s) é recusado", () => {
  const r = lerEntrada({ ...base, audio: { mime_type: "audio/webm", base64: "AAAA", duracao_s: 186 } });
  assertEquals(r, { ok: false, error: "Áudio acima de 3 minutos" });
  assertEquals(lerEntrada({ ...base, audio: { mime_type: "audio/webm", base64: "AAAA", duracao_s: 183 } }).ok, true);
});

Deno.test("formato de áudio, client_id e data inválidos têm mensagem própria", () => {
  assertEquals(lerEntrada({ ...base, audio: { mime_type: "audio/flac", base64: "AAAA", duracao_s: 1 } }).ok, false);
  assertEquals(lerEntrada({ ...base, client_id: "x", texto: "a" }), { ok: false, error: "client_id inválido" });
  assertEquals(lerEntrada({ ...base, data: "19/10/2026", texto: "a" }), { ok: false, error: "data inválida" });
});

Deno.test("mais de 6 fotos é recusado e corpo que não é objeto também", () => {
  const f = { content_type: "image/jpeg", image_base64: "AAAA" };
  assertEquals(lerEntrada({ ...base, fotos: Array(7).fill(f) }), {
    ok: false,
    error: "No máximo 6 fotos por registro",
  });
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
});
