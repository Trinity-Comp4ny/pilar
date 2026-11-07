import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  erroDoEnvioPulado,
  parcelaCobravel,
  podeEnviarCobranca,
  verificarDestinos,
  verificarRascunho,
} from "./regras.ts";

const rascunho = { id: "c1", empresa_id: "e1", status: "rascunho" };

Deno.test("só envia quem vê dinheiro E edita o financeiro", () => {
  assertEquals(podeEnviarCobranca(true, true), true);
  assertEquals(podeEnviarCobranca(true, false), false);
  assertEquals(podeEnviarCobranca(false, true), false);
  // RPC com erro devolve null: nega, não libera.
  assertEquals(podeEnviarCobranca(null, null), false);
  assertEquals(podeEnviarCobranca("true", true), false);
});

Deno.test("rascunho da própria empresa e ainda aberto pode sair", () => {
  assertEquals(verificarRascunho(rascunho, "e1"), { ok: true, cobranca: rascunho });
});

Deno.test("rascunho de outra empresa responde como inexistente (404), sem vazar que existe", () => {
  assertEquals(verificarRascunho(rascunho, "e2"), { ok: false, status: 404, error: "Cobrança não encontrada" });
  assertEquals(verificarRascunho(null, "e1"), { ok: false, status: 404, error: "Cobrança não encontrada" });
});

Deno.test("clique duplo: rascunho já enviado, cancelado ou recusado não sai de novo (409)", () => {
  for (const status of ["enviada", "cancelada", "recusada"]) {
    assertEquals(
      verificarRascunho({ ...rascunho, status }, "e1"),
      { ok: false, status: 409, error: "Esta cobrança já foi decidida" },
      status
    );
  }
});

Deno.test("parcela pendente ou atrasada pode ser cobrada; paga, excluída ou inexistente não", () => {
  assertEquals(parcelaCobravel({ status: "Pendente", deleted_at: null }), true);
  assertEquals(parcelaCobravel({ status: "Atrasado", deleted_at: null }), true);
  assertEquals(parcelaCobravel({ status: "Recebido", deleted_at: null }), false);
  assertEquals(parcelaCobravel({ status: "Cancelado", deleted_at: null }), false);
  assertEquals(parcelaCobravel({ status: "Pendente", deleted_at: "2026-11-01T00:00:00Z" }), false);
  assertEquals(parcelaCobravel(null), false);
});

Deno.test("cliente sem e-mail válido: 400; empresa sem e-mail: 422", () => {
  assertEquals(verificarDestinos("cliente@obra.com.br", "contato@escritorio.com"), { ok: true });
  for (const email of ["", "cliente", "cliente@obra", "cli ente@obra.com"]) {
    const r = verificarDestinos(email, "contato@escritorio.com");
    assertEquals(r.ok ? 0 : r.status, 400, email);
  }
  const semEmpresa = verificarDestinos("cliente@obra.com.br", null);
  assertEquals(semEmpresa.ok ? 0 : semEmpresa.status, 422);
  const vazio = verificarDestinos("cliente@obra.com.br", "");
  assertEquals(vazio.ok ? 0 : vazio.status, 422);
});

Deno.test("e-mail que não saiu: ambiente sem envio é 503, destinatário bloqueado é 422", () => {
  assertEquals(erroDoEnvioPulado("dry_run").status, 503);
  assertEquals(erroDoEnvioPulado("suprimido").status, 422);
  assertEquals(
    erroDoEnvioPulado("suprimido").error,
    "O e-mail do cliente está bloqueado para envio (descadastro ou devolução)"
  );
});
