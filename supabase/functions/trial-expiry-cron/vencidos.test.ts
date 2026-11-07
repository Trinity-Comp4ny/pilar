import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { separarTrialsVencidos, type TrialVencido } from "./avisos.ts";

const ativou: TrialVencido = {
  id: "s1",
  empresa_id: "e1",
  plan_id: "p1",
  billing_cycle: "monthly",
  asaas_customer_id: "cus_1",
  asaas_credit_card_token: "tok_1",
};

const ids = (rows: TrialVencido[]) => rows.map((r) => r.id);

Deno.test("quem ativou o plano (token, cliente e plano) converte; quem não ativou expira", () => {
  const nuncaAtivou = { ...ativou, id: "s2", asaas_credit_card_token: null, asaas_customer_id: null };
  const r = separarTrialsVencidos([ativou, nuncaAtivou]);
  assertEquals(ids(r.converter), ["s1"]);
  assertEquals(ids(r.expirar), ["s2"]);
});

Deno.test("faltando qualquer peça (token, cliente ou plano) o trial expira em vez de cobrar", () => {
  const semToken = { ...ativou, id: "a", asaas_credit_card_token: null };
  const tokenVazio = { ...ativou, id: "b", asaas_credit_card_token: "" };
  const semCliente = { ...ativou, id: "c", asaas_customer_id: null };
  const semPlano = { ...ativou, id: "d", plan_id: null };
  const r = separarTrialsVencidos([semToken, tokenVazio, semCliente, semPlano]);
  assertEquals(r.converter, []);
  assertEquals(ids(r.expirar), ["a", "b", "c", "d"]);
});

Deno.test("ciclo nulo não impede a conversão (cai no mensal na cobrança)", () => {
  const r = separarTrialsVencidos([{ ...ativou, billing_cycle: null }]);
  assertEquals(ids(r.converter), ["s1"]);
});

Deno.test("lista vazia não converte nem expira ninguém", () => {
  assertEquals(separarTrialsVencidos([]), { converter: [], expirar: [] });
});

Deno.test("cada trial cai em exatamente uma lista (nunca cobra e expira o mesmo)", () => {
  const rows = [ativou, { ...ativou, id: "s2", plan_id: null }, { ...ativou, id: "s3" }];
  const r = separarTrialsVencidos(rows);
  assertEquals(r.converter.length + r.expirar.length, rows.length);
  assertEquals(
    r.converter.some((c) => r.expirar.includes(c)),
    false
  );
});
