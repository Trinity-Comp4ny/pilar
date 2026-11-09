import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { hashDoToken, lerEntrada, saidaDaConsulta } from "./entrada.ts";

const token = "xK3v9Qe2mT7pAbCdEfGhIjKlMnOpQrStUvWxYz01234"; // 43 caracteres base64url

const resposta = {
  acao: "responder",
  token,
  valor: 20900,
  condicao_pagamento: "30 dias",
  prazo_entrega_dias: 5,
};

Deno.test("consultar aceita só o token no corpo", () => {
  assertEquals(lerEntrada({ acao: "consultar", token }).ok, true);
});

Deno.test("token fora do formato é recusado com a mesma mensagem", () => {
  for (const ruim of ["", "curto", `${token}!`, `${token} ${token}`, "a".repeat(65)]) {
    assertEquals(lerEntrada({ acao: "consultar", token: ruim }), { ok: false, error: "Link inválido" });
  }
});

Deno.test("ação desconhecida e corpo que não é objeto são recusados", () => {
  assertEquals(lerEntrada({ acao: "apagar", token }).ok, false);
  assertEquals(lerEntrada(null), { ok: false, error: "Corpo da requisição inválido" });
  assertEquals(lerEntrada([token]), { ok: false, error: "Corpo da requisição inválido" });
});

Deno.test("resposta mínima passa e os opcionais viram null", () => {
  const r = lerEntrada(resposta);
  assertEquals(r.ok, true);
  if (r.ok && r.data.acao === "responder") {
    assertEquals(r.data.valor_parcelado, null);
    assertEquals(r.data.desconto_pct, null);
    assertEquals(r.data.observacoes, null);
  }
});

Deno.test("valor negativo, zero, texto e acima do teto são recusados", () => {
  assertEquals(lerEntrada({ ...resposta, valor: -1 }), { ok: false, error: "O valor precisa ser maior que zero" });
  assertEquals(lerEntrada({ ...resposta, valor: 0 }).ok, false);
  assertEquals(lerEntrada({ ...resposta, valor: "20900" }).ok, false);
  assertEquals(lerEntrada({ ...resposta, valor: 1_000_000_000 }).ok, false);
});

Deno.test("prazo fracionado ou negativo é recusado", () => {
  assertEquals(lerEntrada({ ...resposta, prazo_entrega_dias: 2.5 }), {
    ok: false,
    error: "O prazo é um número inteiro de dias",
  });
  assertEquals(lerEntrada({ ...resposta, prazo_entrega_dias: -1 }).ok, false);
});

Deno.test("desconto fora de 0 a 100 e condição vazia são recusados", () => {
  assertEquals(lerEntrada({ ...resposta, desconto_pct: 101 }).ok, false);
  assertEquals(lerEntrada({ ...resposta, desconto_pct: -3 }).ok, false);
  assertEquals(lerEntrada({ ...resposta, condicao_pagamento: "   " }).ok, false);
});

Deno.test("o hash do token é o SHA-256 em hex que o banco guarda", async () => {
  const h = await hashDoToken("abc");
  assertEquals(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assertNotEquals(await hashDoToken("abd"), h);
});

Deno.test("a saída da consulta só leva os campos da lista fixa", () => {
  const saida = saidaDaConsulta({
    ok: true,
    empresa_nome: "Alfa Engenharia",
    descricao: "Cimento CP-II 50 kg",
    quantidade: 400,
    unidade: "saco",
    prazo_necessidade: "2026-11-06",
    observacoes: null,
    expira_em: "2026-11-04T12:00:00Z",
    resposta_atual: null,
    obra_id: "nao-pode-vazar",
    propostas: [{ valor: 1 }],
  });
  assertEquals(Object.keys(saida).sort(), [
    "descricao",
    "empresa_nome",
    "expira_em",
    "observacoes",
    "ok",
    "prazo_necessidade",
    "quantidade",
    "resposta_atual",
    "unidade",
  ]);
});

Deno.test("consulta que falhou no banco vira só ok=false", () => {
  assertEquals(saidaDaConsulta({ ok: false }), { ok: false });
  assertEquals(saidaDaConsulta(null), { ok: false });
  assertEquals(saidaDaConsulta({ ok: "true" }), { ok: false });
});
