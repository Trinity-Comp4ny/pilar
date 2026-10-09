import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { atualizacaoDaReceita, autorizarToken } from "./regras.ts";

const configs = [
  { empresa_id: "empresa-a", webhook_token: "token-a" },
  { empresa_id: "empresa-b", webhook_token: "token-b" },
  { empresa_id: "empresa-sem-token", webhook_token: null },
];

Deno.test("token de uma empresa autoriza e identifica SÓ aquela empresa", () => {
  assertEquals(autorizarToken("token-b", configs, undefined), { valido: true, empresaId: "empresa-b" });
});

Deno.test("sem token, token errado ou prefixo de token válido: não autoriza", () => {
  assertEquals(autorizarToken(null, configs, "global"), { valido: false });
  assertEquals(autorizarToken("token-c", configs, undefined), { valido: false });
  assertEquals(autorizarToken("token-", configs, undefined), { valido: false });
});

Deno.test("empresa com webhook_token nulo nunca casa com token vazio", () => {
  assertEquals(autorizarToken("", configs, undefined), { valido: false });
});

Deno.test("token global de env autoriza sem empresa; token de empresa tem prioridade", () => {
  assertEquals(autorizarToken("global", configs, "global"), { valido: true, empresaId: null });
  assertEquals(autorizarToken("token-a", configs, "token-a"), { valido: true, empresaId: "empresa-a" });
});

Deno.test("token global ausente não vira curinga", () => {
  assertEquals(autorizarToken("qualquer", [], undefined), { valido: false });
  assertEquals(autorizarToken("qualquer", [], ""), { valido: false });
});

Deno.test("pagamento recebido marca a receita como Recebido com a data do Asaas e libera o marco", () => {
  for (const evento of ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]) {
    assertEquals(
      atualizacaoDaReceita(evento, { status: "RECEIVED", paymentDate: "2026-10-05" }, "2026-10-07"),
      {
        campos: { asaas_payment_status: "RECEIVED", status: "Recebido", data_recebimento: "2026-10-05" },
        marcarMarcoRecebido: true,
      },
      evento
    );
  }
});

Deno.test("recebido sem data do Asaas usa hoje", () => {
  assertEquals(
    atualizacaoDaReceita("PAYMENT_RECEIVED", { status: "RECEIVED" }, "2026-10-07")?.campos.data_recebimento,
    "2026-10-07"
  );
});

Deno.test("atraso marca Atrasado sem data de recebimento nem marco", () => {
  assertEquals(atualizacaoDaReceita("PAYMENT_OVERDUE", { status: "OVERDUE" }, "2026-10-07"), {
    campos: { asaas_payment_status: "OVERDUE", status: "Atrasado" },
    marcarMarcoRecebido: false,
  });
});

Deno.test("estorno e exclusão só espelham o status do Asaas", () => {
  for (const evento of ["PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_AWAITING_RISK_ANALYSIS"]) {
    assertEquals(
      atualizacaoDaReceita(evento, { status: "REFUNDED" }, "2026-10-07"),
      { campos: { asaas_payment_status: "REFUNDED" }, marcarMarcoRecebido: false },
      evento
    );
  }
});

Deno.test("evento fora da lista (inclusive nome de propriedade do protótipo) não mexe na receita", () => {
  for (const evento of ["PAYMENT_CREATED", "toString", "constructor", "__proto__"]) {
    assertEquals(atualizacaoDaReceita(evento, { status: "X" }, "2026-10-07"), null, evento);
  }
});
