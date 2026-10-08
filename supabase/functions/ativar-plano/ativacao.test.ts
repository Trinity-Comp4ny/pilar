import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  bodySchema,
  CONSENTIMENTO_TEXTO_VERSAO,
  CONSENTIMENTO_TEXTO_VERSAO_IMEDIATA,
  ehTokenizacaoSemPermissao,
  modoEfetivo,
  primeiraCobrancaEm,
  valorDoCiclo,
  verificarAssinatura,
} from "./ativacao.ts";

const emTrial = {
  id: "sub1",
  status: "trialing",
  trial_ends_at: "2026-10-21T15:30:00.000Z",
  asaas_customer_id: null,
};

const corpoValido = {
  plan_id: "6f1c1b5e-2c47-4a8e-9b1d-3f2a7c9e0d11",
  billing_cycle: "monthly",
  credit_card: {
    holderName: "Fulana Souza",
    number: "5555555555554444",
    expiryMonth: "01",
    expiryYear: "2031",
    ccv: "321",
  },
  credit_card_holder_info: {
    name: "Fulana Souza",
    email: "fulana@exemplo.com",
    cpfCnpj: "12.345.678/0001-90",
    postalCode: "30140-071",
    addressNumber: "10",
    phone: "(31) 98765-4321",
  },
};

const antesDoFim = new Date("2026-10-20T12:00:00.000Z");
const depoisDoFim = new Date("2026-10-22T12:00:00.000Z");

Deno.test("em teste: ativa com a cobrança agendada para o fim do trial", () => {
  assertEquals(verificarAssinatura(emTrial, antesDoFim), { ok: true, sub: emTrial, modo: "agendada" });
});

Deno.test("teste vencido (expired) assina com cobrança imediata", () => {
  const r = verificarAssinatura({ ...emTrial, status: "expired" }, depoisDoFim);
  assertEquals(r.ok && r.modo, "imediata");
});

Deno.test("trialing com a data já vencida (cron ainda não rodou) também cobra na hora", () => {
  const r = verificarAssinatura(emTrial, depoisDoFim);
  assertEquals(r.ok && r.modo, "imediata");
});

Deno.test("expired sem trial_ends_at não é erro: a referência vira agora", () => {
  const r = verificarAssinatura({ ...emTrial, status: "expired", trial_ends_at: null }, depoisDoFim);
  assertEquals(r.ok && r.sub.trial_ends_at, depoisDoFim.toISOString());
});

Deno.test("assinatura cancelada assina de novo com cobrança imediata", () => {
  const r = verificarAssinatura({ ...emTrial, status: "canceled", trial_ends_at: null }, depoisDoFim);
  assertEquals(r.ok && r.modo, "imediata");
});

Deno.test("sem assinatura, assinatura ativa ou em atraso: recusa com status próprio", () => {
  assertEquals(verificarAssinatura(null), { ok: false, status: 404, error: "Assinatura não encontrada" });
  for (const status of ["active", "overdue"]) {
    const r = verificarAssinatura({ ...emTrial, status });
    assertEquals(r.ok ? 0 : r.status, 400, status);
  }
});

Deno.test("trial sem data de fim é erro de dado (500), não do usuário", () => {
  const r = verificarAssinatura({ ...emTrial, trial_ends_at: null });
  assertEquals(r.ok ? 0 : r.status, 500);
});

Deno.test("valor vem do plano pelo ciclo; ciclo sem preço devolve null", () => {
  const plano = { preco_mensal: 690, preco_anual: 6900 };
  assertEquals(valorDoCiclo(plano, "monthly"), 690);
  assertEquals(valorDoCiclo(plano, "yearly"), 6900);
  assertEquals(valorDoCiclo({ preco_mensal: 690, preco_anual: null }, "yearly"), null);
});

Deno.test("primeira cobrança é a data (sem hora) do fim do trial", () => {
  assertEquals(primeiraCobrancaEm(emTrial.trial_ends_at), "2026-10-21");
});

Deno.test("entrada: cartão e titular obrigatórios, plano é uuid, ciclo só mensal ou anual", () => {
  assertEquals(bodySchema.safeParse(corpoValido).success, true);
  assertEquals(bodySchema.safeParse({ ...corpoValido, credit_card: undefined }).success, false);
  assertEquals(bodySchema.safeParse({ ...corpoValido, credit_card_holder_info: undefined }).success, false);
  assertEquals(bodySchema.safeParse({ ...corpoValido, plan_id: "plano-pro" }).success, false);
  assertEquals(bodySchema.safeParse({ ...corpoValido, billing_cycle: "weekly" }).success, false);
});

Deno.test("entrada: valor mandado pelo cliente é descartado (preço vem só do plano)", () => {
  const r = bodySchema.safeParse({ ...corpoValido, valor: 1, preco_mensal: 1 });
  assertEquals(r.success && "valor" in r.data, false);
});

Deno.test("versão do texto de consentimento é fixa no servidor", () => {
  // Trocar a versão é decisão consciente (mudou a copy do passo "Ativar plano").
  assertEquals(CONSENTIMENTO_TEXTO_VERSAO, "ativar-plano-v1");
  assertEquals(CONSENTIMENTO_TEXTO_VERSAO_IMEDIATA, "assinar-apos-teste-v1");
});

Deno.test("cobrar_agora força cobrança hoje mesmo em teste; sem ele, vale o modo da assinatura", () => {
  assertEquals(modoEfetivo("agendada", true), "imediata");
  assertEquals(modoEfetivo("agendada", undefined), "agendada");
  assertEquals(modoEfetivo("imediata", false), "imediata");
});

Deno.test("reconhece a recusa do Asaas por tokenização não liberada", () => {
  assertEquals(
    ehTokenizacaoSemPermissao(
      "Asaas: Você não possui permissão para utilizar este recurso. Entre em contato com seu gerente de contas."
    ),
    true
  );
  assertEquals(ehTokenizacaoSemPermissao("Asaas: Cartão recusado pela operadora"), false);
});

Deno.test("entrada: cobrar_agora é opcional e só aceita boolean", () => {
  assertEquals(bodySchema.safeParse({ ...corpoValido, cobrar_agora: true }).success, true);
  assertEquals(bodySchema.safeParse({ ...corpoValido, cobrar_agora: "sim" }).success, false);
});

Deno.test("entrada: telefone do titular é obrigatório (o Asaas recusa sem ele) e vira só dígitos", () => {
  const semTelefone = {
    ...corpoValido,
    credit_card_holder_info: { ...corpoValido.credit_card_holder_info, phone: undefined },
  };
  assertEquals(bodySchema.safeParse(semTelefone).success, false);
  const curto = {
    ...corpoValido,
    credit_card_holder_info: { ...corpoValido.credit_card_holder_info, phone: "9876-5432" },
  };
  assertEquals(bodySchema.safeParse(curto).success, false);
  const r = bodySchema.safeParse(corpoValido);
  assertEquals(r.success && r.data.credit_card_holder_info.phone, "31987654321");
});
