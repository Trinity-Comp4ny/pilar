import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada, MAX_MESSAGE_LEN, MAX_SUBJECT_LEN } from "./entrada.ts";

const base = {
  cliente_id: "6f1c2a9e-1b2c-4d3e-8f4a-5b6c7d8e9f00",
  subject: "Reunião",
  message: "Podemos falar amanhã?",
};

Deno.test("aceita assunto e mensagem para um cliente", () => {
  assertEquals(lerEntrada(base).ok, true);
});

Deno.test("mantém as mensagens que a tela já mostrava", () => {
  assertEquals(lerEntrada({ ...base, subject: "  " }), { ok: false, error: "Assunto obrigatório" });
  assertEquals(lerEntrada({ ...base, message: 7 }), { ok: false, error: "Mensagem obrigatória" });
  assertEquals(lerEntrada({ ...base, subject: "a".repeat(MAX_SUBJECT_LEN + 1) }), {
    ok: false,
    error: `Assunto excede ${MAX_SUBJECT_LEN} caracteres`,
  });
  assertEquals(lerEntrada({ ...base, message: "a".repeat(MAX_MESSAGE_LEN + 1) }), {
    ok: false,
    error: `Mensagem excede ${MAX_MESSAGE_LEN} caracteres`,
  });
});

Deno.test("destinatário é sempre um cliente (uuid), nunca e-mail livre", () => {
  assertEquals(lerEntrada({ ...base, cliente_id: "alguem@fora.com" }), { ok: false, error: "cliente_id inválido" });
});
