// Roda com: deno test --allow-env supabase/functions/pilar-token-pack-create
//
// Cobre o bug real de 03/09 (Sentry PILAR-1Y/2K): nenhuma das 5 empresas
// ativas em produção tinha asaas_customer_id, então toda compra de pacote
// morria em "Sua empresa ainda não tem cobrança ativa". O cliente passou a ser
// criado na primeira compra, e o que decide se isso é possível é de onde vem o
// CPF/CNPJ.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolverDadosCliente } from "./customer.ts";

const holder = {
  name: "Liz Almendro",
  email: "liz@vrz.com.br",
  cpfCnpj: "123.456.789-09",
  phone: "(19) 99999-0000",
};

Deno.test("cartão: usa o titular informado no pagamento e limpa a máscara", () => {
  const r = resolverDadosCliente({ holder, empresa: { nome: "VRZ", cnpj: "11.222.333/0001-44" } });
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.dados.cpfCnpj, "12345678909");
  assertEquals(r.dados.name, "Liz Almendro");
  assertEquals(r.dados.email, "liz@vrz.com.br");
  assertEquals(r.dados.phone, "(19) 99999-0000");
});

Deno.test("PIX/boleto: sem titular, cai no CNPJ cadastrado da empresa", () => {
  const r = resolverDadosCliente({
    empresa: { nome: "LTS Engenharia", cnpj: "11.222.333/0001-44", email: "financeiro@lts.com.br" },
  });
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.dados.cpfCnpj, "11222333000144");
  assertEquals(r.dados.name, "LTS Engenharia");
  assertEquals(r.dados.email, "financeiro@lts.com.br");
});

Deno.test("PIX/boleto sem CNPJ na empresa: erro diz o que fazer, não manda falar com suporte", () => {
  const r = resolverDadosCliente({ empresa: { nome: "Mawe Arquitetos", email: "rafael@mawe.com.br" } });
  assertEquals(r.ok, false);
  if (r.ok) return;
  assertEquals(r.error.includes("Cadastre o CNPJ"), true);
  assertEquals(r.error.includes("suporte"), false);
});

Deno.test("documento com número de dígitos inválido é recusado", () => {
  for (const cnpj of ["123", "1234567890", "123456789012345", ""]) {
    const r = resolverDadosCliente({ empresa: { nome: "X", email: "x@x.com", cnpj } });
    assertEquals(r.ok, false, `deveria recusar "${cnpj}"`);
  }
});

Deno.test("sem e-mail na empresa, usa o do usuário que está comprando", () => {
  const r = resolverDadosCliente({
    empresa: { nome: "MF Construção", cnpj: "11222333000144" },
    userEmail: "admin@mf.com.br",
  });
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.dados.email, "admin@mf.com.br");
});

Deno.test("sem nome ou e-mail em lugar nenhum: erro de contato, não de documento", () => {
  const r = resolverDadosCliente({ empresa: { cnpj: "11222333000144" } });
  assertEquals(r.ok, false);
  if (r.ok) return;
  assertEquals(r.error.includes("nome e o e-mail"), true);
});

Deno.test("campo em branco não conta como preenchido", () => {
  const r = resolverDadosCliente({ empresa: { nome: "   ", email: "  ", cnpj: "11222333000144" } });
  assertEquals(r.ok, false);
});
