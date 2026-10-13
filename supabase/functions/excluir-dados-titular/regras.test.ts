import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerEntrada } from "./entrada.ts";
import { ehUnicoAdmin, recusaDaDecisao } from "./regras.ts";

const ID = "00000000-0000-0000-0000-0000000000aa";

Deno.test("único admin ativo: só quando é admin, está ativo e não há outro", () => {
  assertEquals(ehUnicoAdmin("admin", null, 0), true);
  assertEquals(ehUnicoAdmin("owner", null, 0), true);
  assertEquals(ehUnicoAdmin("admin", null, 1), false);
  assertEquals(ehUnicoAdmin("colaborador", null, 0), false);
  assertEquals(ehUnicoAdmin("admin", "2026-10-13T00:00:00Z", 0), false);
});

Deno.test("aprovar com titular único admin é recusado", () => {
  assertEquals(recusaDaDecisao("pending", "aprovar", true)?.status, 409);
});

Deno.test("recusar continua possível mesmo com titular único admin", () => {
  assertEquals(recusaDaDecisao("pending", "recusar", true), null);
});

Deno.test("pedido que falhou pode ser aprovado de novo; decidido não", () => {
  assertEquals(recusaDaDecisao("failed", "aprovar", false), null);
  assertEquals(recusaDaDecisao("completed", "aprovar", false)?.status, 409);
  assertEquals(recusaDaDecisao("rejected", "recusar", false)?.status, 409);
  assertEquals(recusaDaDecisao("in_progress", "aprovar", false)?.status, 409);
});

Deno.test("entrada: aprovar só precisa do pedido", () => {
  assertEquals(lerEntrada({ acao: "aprovar", request_id: ID }), {
    ok: true,
    data: { acao: "aprovar", request_id: ID },
  });
});

Deno.test("entrada: recusar exige motivo", () => {
  assertEquals(lerEntrada({ acao: "recusar", request_id: ID }).ok, false);
  assertEquals(lerEntrada({ acao: "recusar", request_id: ID, motivo: "  " }), {
    ok: false,
    error: "Informe o motivo da recusa",
  });
});

Deno.test("entrada: ação desconhecida e corpo inválido", () => {
  assertEquals(lerEntrada({ acao: "apagar", request_id: ID }), {
    ok: false,
    error: "acao deve ser aprovar ou recusar",
  });
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
  assertEquals(lerEntrada({ acao: "aprovar", request_id: "x" }), { ok: false, error: "request_id inválido" });
});
