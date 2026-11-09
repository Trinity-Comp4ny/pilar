import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { cartaoRecusado, checkoutSchema } from "./entrada.ts";

const base = {
  email: "dono@escritorio.com",
  nome: "Ana Souza",
  company_name: "Escritório Souza",
  cpf_cnpj: "123.456.789-09",
  plan_slug: "pro",
  billing_cycle: "monthly",
  billing_type: "PIX",
};

Deno.test("PIX e boleto não pedem cartão; CPF/CNPJ vira só dígitos", () => {
  const r = checkoutSchema.safeParse(base);
  assertEquals(r.success && r.data.cpf_cnpj, "12345678909");
  assertEquals(checkoutSchema.safeParse({ ...base, billing_type: "BOLETO" }).success, true);
});

Deno.test("cartão exige dados do cartão e do titular", () => {
  assertEquals(checkoutSchema.safeParse({ ...base, billing_type: "CREDIT_CARD" }).success, false);
  const comCartao = checkoutSchema.safeParse({
    ...base,
    billing_type: "CREDIT_CARD",
    credit_card: {
      holderName: "ANA SOUZA",
      number: "4111111111111111",
      expiryMonth: "09",
      expiryYear: "2030",
      ccv: "123",
    },
    credit_card_holder_info: {
      name: "Ana Souza",
      email: "ana@x.com",
      cpfCnpj: "12345678909",
      postalCode: "01310-100",
      addressNumber: "100",
    },
  });
  assertEquals(comCartao.success, true);
});

Deno.test("ciclo, forma de pagamento e documento fora do formato são recusados", () => {
  assertEquals(checkoutSchema.safeParse({ ...base, billing_cycle: "weekly" }).success, false);
  assertEquals(checkoutSchema.safeParse({ ...base, billing_type: "DINHEIRO" }).success, false);
  assertEquals(checkoutSchema.safeParse({ ...base, cpf_cnpj: "123" }).success, false);
});

const cartaoValido = {
  holderName: "ANA SOUZA",
  number: "4111111111111111",
  expiryMonth: "09",
  expiryYear: "2030",
  ccv: "123",
};
const titularValido = {
  name: "Ana Souza",
  email: "ana@x.com",
  cpfCnpj: "12345678909",
  postalCode: "01310-100",
  addressNumber: "100",
};
const comCartao = (card: object, holder: object) =>
  checkoutSchema.safeParse({ ...base, billing_type: "CREDIT_CARD", credit_card: card, credit_card_holder_info: holder })
    .success;

Deno.test("cartão sem os dados do titular (ou titular sem cartão) é recusado", () => {
  assertEquals(
    checkoutSchema.safeParse({ ...base, billing_type: "CREDIT_CARD", credit_card: cartaoValido }).success,
    false
  );
  assertEquals(
    checkoutSchema.safeParse({ ...base, billing_type: "CREDIT_CARD", credit_card_holder_info: titularValido }).success,
    false
  );
});

Deno.test("número, validade e CCV do cartão fora do formato são recusados antes do Asaas", () => {
  assertEquals(comCartao(cartaoValido, titularValido), true);
  for (const errado of [
    { number: "4111 1111 1111 1111" },
    { number: "411111111111" },
    { number: "41111111111111111111" },
    { expiryMonth: "13" },
    { expiryMonth: "00" },
    { expiryMonth: "9" },
    { expiryYear: "30" },
    { ccv: "12" },
    { ccv: "12345" },
    { holderName: "A" },
  ]) {
    assertEquals(comCartao({ ...cartaoValido, ...errado }, titularValido), false, JSON.stringify(errado));
  }
});

Deno.test("titular com CPF/CNPJ, CEP, e-mail ou número fora do formato é recusado", () => {
  for (const errado of [
    { cpfCnpj: "1234567890" },
    { cpfCnpj: "123456789012" },
    { postalCode: "0131010" },
    { email: "sem-arroba" },
    { addressNumber: "" },
    { name: "" },
  ]) {
    assertEquals(comCartao(cartaoValido, { ...titularValido, ...errado }), false, JSON.stringify(errado));
  }
});

Deno.test("CNPJ com máscara é aceito e vira 14 dígitos", () => {
  const r = checkoutSchema.safeParse({ ...base, cpf_cnpj: "12.345.678/0001-95" });
  assertEquals(r.success && r.data.cpf_cnpj, "12345678000195");
});

Deno.test("campos obrigatórios ausentes ou vazios são recusados", () => {
  for (const campo of ["email", "nome", "company_name", "cpf_cnpj", "plan_slug", "billing_cycle", "billing_type"]) {
    const semCampo: Record<string, unknown> = { ...base };
    delete semCampo[campo];
    assertEquals(checkoutSchema.safeParse(semCampo).success, false, `sem ${campo}`);
  }
  assertEquals(checkoutSchema.safeParse({ ...base, plan_slug: "   " }).success, false);
  assertEquals(checkoutSchema.safeParse({ ...base, nome: "A" }).success, false);
  assertEquals(checkoutSchema.safeParse({ ...base, email: "nao-e-email" }).success, false);
  assertEquals(checkoutSchema.safeParse(null).success, false);
});

Deno.test("e-mail é normalizado (minúsculo, sem espaço) para a checagem de conta existente", () => {
  const r = checkoutSchema.safeParse({ ...base, email: "  Dono@Escritorio.COM " });
  assertEquals(r.success && r.data.email, "dono@escritorio.com");
});

Deno.test("cliente não manda valor: campo extra de preço é descartado", () => {
  const r = checkoutSchema.safeParse({ ...base, value: 1, preco_mensal: 1 });
  assertEquals(r.success && "value" in r.data, false);
  assertEquals(r.success && "preco_mensal" in r.data, false);
});

Deno.test("cartaoRecusado reconhece a recusa do banco emissor e ignora outras falhas do Asaas", () => {
  assertEquals(
    cartaoRecusado("Asaas: Transação não autorizada. Verifique os dados do cartão de crédito e tente novamente."),
    true
  );
  assertEquals(cartaoRecusado("Asaas: Você não possui permissão para utilizar este recurso."), false);
  assertEquals(cartaoRecusado("Asaas 500"), false);
});

Deno.test("cartaoRecusado tolera a mensagem sem acento e em caixa diferente; mensagem vazia não é recusa", () => {
  assertEquals(cartaoRecusado("Asaas: TRANSACAO NAO AUTORIZADA"), true);
  assertEquals(cartaoRecusado(""), false);
  assertEquals(cartaoRecusado("Asaas: O campo creditCard deve ser informado."), false);
});
