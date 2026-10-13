import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { checkoutSchema } from "./entrada.ts";

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
