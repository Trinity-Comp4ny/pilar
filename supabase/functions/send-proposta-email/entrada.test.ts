import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_ATTACHMENT_B64 } from "./entrada.ts";

const base = { email: "cliente@x.com", subject: "Proposta", attachment_base64: "UEsDBA==" };

Deno.test("envio mínimo: e-mail, assunto e anexo", () => {
  const r = lerEntrada(base);
  assertEquals(r.ok && r.data.email, "cliente@x.com");
});

Deno.test("mantém as mensagens que a tela já mostrava", () => {
  assertEquals(lerEntrada({ ...base, email: "x" }), { ok: false, error: "Email inválido" });
  assertEquals(lerEntrada({ ...base, subject: 3 }), { ok: false, error: "Assunto obrigatório" });
  assertEquals(lerEntrada({ ...base, attachment_base64: "" }), { ok: false, error: "Documento obrigatório" });
  assertEquals(lerEntrada({ ...base, attachment_base64: "A".repeat(MAX_ATTACHMENT_B64 + 1) }), {
    ok: false,
    error: "Documento excede o tamanho máximo (10 MB)",
  });
});

Deno.test("nome do anexo vira só um nome, sem caminho nem quebra de linha", () => {
  const r = lerEntrada({ ...base, filename: "../propostas/\r\nP-12.docx" });
  assertEquals(r.ok && r.data.filename, ".._propostas___P-12.docx");
});

Deno.test("campos opcionais vazios somem; proposta_id inválido é recusado", () => {
  const r = lerEntrada({ ...base, filename: "", proposta_id: "", nome_cliente: "  ", doc_mode: "outro" });
  assertEquals(r.ok && [r.data.filename, r.data.proposta_id, r.data.nome_cliente, r.data.doc_mode], [
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  assertEquals(lerEntrada({ ...base, proposta_id: "abc" }).ok, false);
});
