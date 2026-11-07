// Conversão do trial em assinatura paga (SPEC 098/104): o que é cobrado no Asaas,
// o que é gravado no banco e o que acontece quando a cobrança ou a gravação falham.
// Banco é um fake encadeável; Asaas é o fetch trocado.

import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("ASAAS_PLATFORM_API_KEY", "test-key");
Deno.env.set("ASAAS_PLATFORM_ENV", "sandbox");
// Recibo por e-mail sem Resend: o envio vira dry_run (sem rede).
Deno.env.set("EMAIL_DRY_RUN", "true");

const { converterEmAssinaturaAtiva } = await import("./converter-assinatura.ts");

type Operacao = { tabela: string; tipo: "select" | "update" | "insert"; valores?: unknown; filtros: unknown[][] };

interface Respostas {
  plano?: { nome: string; preco_mensal: number | null; preco_anual: number | null } | null;
  empresa?: { nome: string } | null;
  admins?: { email: string | null }[];
  erroAoAtivar?: { message: string } | null;
}

function fakeAdmin(r: Respostas) {
  const ops: Operacao[] = [];
  const client = {
    from(tabela: string) {
      const op: Operacao = { tabela, tipo: "select", filtros: [] };
      ops.push(op);
      const resultado = () => {
        if (op.tipo === "update" && tabela === "pilar_subscriptions") return { error: r.erroAoAtivar ?? null };
        if (op.tipo !== "select") return { error: null };
        if (tabela === "pilar_subscription_plans") return { data: r.plano ?? null, error: null };
        if (tabela === "empresas") return { data: r.empresa ?? null, error: null };
        if (tabela === "profiles") return { data: r.admins ?? [], error: null };
        return { data: null, error: null };
      };
      const b: Record<string, unknown> = {
        select: () => b,
        update: (v: unknown) => ((op.tipo = "update"), (op.valores = v), b),
        insert: (v: unknown) => ((op.tipo = "insert"), (op.valores = v), b),
        eq: (...a: unknown[]) => (op.filtros.push(["eq", ...a]), b),
        in: (...a: unknown[]) => (op.filtros.push(["in", ...a]), b),
        is: (...a: unknown[]) => (op.filtros.push(["is", ...a]), b),
        maybeSingle: () => Promise.resolve(resultado()),
        then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) =>
          Promise.resolve(resultado()).then(ok, erro),
      };
      return b;
    },
  };
  return { client, ops };
}

function stubAsaas(impl: (body: Record<string, unknown>) => Response) {
  const original = globalThis.fetch;
  const corpos: Record<string, unknown>[] = [];
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    corpos.push(body);
    return Promise.resolve(impl(body));
  }) as typeof fetch;
  return { corpos, restore: () => (globalThis.fetch = original) };
}

const asaasOk = () =>
  new Response(
    JSON.stringify({
      id: "sub_asaas_1",
      customer: "cus_1",
      status: "ACTIVE",
      nextDueDate: "2026-11-07",
      value: 690,
      cycle: "MONTHLY",
      billingType: "CREDIT_CARD",
    }),
    { status: 200 }
  );

const row = { id: "s1", empresa_id: "e1", plan_id: "p1", billing_cycle: "monthly", asaas_customer_id: "cus_1" };
const plano = { nome: "Pro", preco_mensal: 690, preco_anual: 6900 };
const opts = { appUrl: "https://app.test", origem: "trial_expirado" as const };

type Cliente = Parameters<typeof converterEmAssinaturaAtiva>[0];
const comoCliente = (c: unknown) => c as Cliente;

Deno.test("conversão mensal com token: cobra o preço mensal no Asaas e ativa a assinatura", async () => {
  const { client, ops } = fakeAdmin({ plano, empresa: { nome: "Escritório" } });
  const asaas = stubAsaas(asaasOk);
  try {
    const r = await converterEmAssinaturaAtiva(comoCliente(client), row, { creditCardToken: "tok_1" }, opts);
    assertEquals(r, { asaasSubscriptionId: "sub_asaas_1", valor: 690, planoNome: "Pro" });

    const corpo = asaas.corpos[0];
    assertEquals(corpo.value, 690);
    assertEquals(corpo.cycle, "MONTHLY");
    assertEquals(corpo.billingType, "CREDIT_CARD");
    assertEquals(corpo.creditCardToken, "tok_1");
    assertEquals(corpo.customer, "cus_1");
    // Cobrança feita pelo servidor (cron) não tem IP de dispositivo.
    assertEquals(corpo.remoteIp, "0.0.0.0");

    const ativacao = ops.find((o) => o.tabela === "pilar_subscriptions" && o.tipo === "update");
    const v = ativacao?.valores as Record<string, unknown>;
    assertEquals(v.status, "active");
    assertEquals(v.asaas_subscription_id, "sub_asaas_1");

    // Sai do modo leitura e zera avisos de retenção.
    const leitura = ops.find((o) => o.tabela === "empresas" && o.tipo === "update");
    assertEquals(leitura?.valores, {
      leitura_desde: null,
      retencao_aviso_60d_sent_at: null,
      retencao_aviso_85d_sent_at: null,
    });
    const audit = ops.find((o) => o.tabela === "admin_audit_logs");
    assertEquals((audit?.valores as { action: string }).action, "trial_converted_active");
  } finally {
    asaas.restore();
  }
});

Deno.test("conversão anual cobra o preço anual, ciclo YEARLY e período de 12 meses", async () => {
  const { client, ops } = fakeAdmin({ plano });
  const asaas = stubAsaas(asaasOk);
  try {
    await converterEmAssinaturaAtiva(
      comoCliente(client),
      { ...row, billing_cycle: "yearly" },
      { creditCardToken: "tok_1" },
      opts
    );
    assertEquals(asaas.corpos[0].value, 6900);
    assertEquals(asaas.corpos[0].cycle, "YEARLY");
    const v = ops.find((o) => o.tabela === "pilar_subscriptions" && o.tipo === "update")?.valores as {
      current_period_start: string;
      current_period_end: string;
    };
    const inicio = new Date(v.current_period_start);
    const fim = new Date(v.current_period_end);
    assertEquals(fim.getFullYear() - inicio.getFullYear(), 1);
  } finally {
    asaas.restore();
  }
});

Deno.test("cartão digitado (assinar após o teste) vai no corpo com o IP do cliente", async () => {
  const { client } = fakeAdmin({ plano });
  const asaas = stubAsaas(asaasOk);
  const creditCard = {
    holderName: "Ana",
    number: "4111111111111111",
    expiryMonth: "01",
    expiryYear: "2031",
    ccv: "123",
  };
  const creditCardHolderInfo = {
    name: "Ana",
    email: "ana@x.com",
    cpfCnpj: "12345678909",
    postalCode: "01310100",
    addressNumber: "1",
    phone: "11987654321",
  };
  try {
    await converterEmAssinaturaAtiva(
      comoCliente(client),
      row,
      { creditCard, creditCardHolderInfo },
      { ...opts, origem: "assinatura_apos_trial", remoteIp: "203.0.113.5" }
    );
    assertEquals(asaas.corpos[0].creditCard, creditCard);
    assertEquals(asaas.corpos[0].creditCardToken, undefined);
    assertEquals(asaas.corpos[0].remoteIp, "203.0.113.5");
  } finally {
    asaas.restore();
  }
});

Deno.test("plano inexistente ou sem preço no ciclo: lança sem cobrar nem gravar", async () => {
  for (const caso of [{ plano: null }, { plano: { ...plano, preco_anual: null } }]) {
    const { client, ops } = fakeAdmin(caso);
    const asaas = stubAsaas(asaasOk);
    try {
      await assertRejects(
        () =>
          converterEmAssinaturaAtiva(
            comoCliente(client),
            { ...row, billing_cycle: "yearly" },
            { creditCardToken: "tok_1" },
            opts
          ),
        Error,
        "plano ou preço ausente na conversão"
      );
      assertEquals(asaas.corpos.length, 0);
      assertEquals(
        ops.some((o) => o.tipo !== "select"),
        false
      );
    } finally {
      asaas.restore();
    }
  }
});

Deno.test("cartão recusado pelo Asaas: lança a mensagem do Asaas e não ativa nada", async () => {
  const { client, ops } = fakeAdmin({ plano });
  const asaas = stubAsaas(
    () => new Response(JSON.stringify({ errors: [{ description: "Transação não autorizada." }] }), { status: 400 })
  );
  try {
    await assertRejects(
      () => converterEmAssinaturaAtiva(comoCliente(client), row, { creditCardToken: "tok_1" }, opts),
      Error,
      "Asaas: Transação não autorizada."
    );
    assertEquals(
      ops.some((o) => o.tipo !== "select"),
      false
    );
  } finally {
    asaas.restore();
  }
});

Deno.test(
  "cobrança criada mas falha ao ativar no banco: lança com o id da cobrança e não tira do modo leitura",
  async () => {
    const { client, ops } = fakeAdmin({ plano, erroAoAtivar: { message: "deadlock" } });
    const asaas = stubAsaas(asaasOk);
    try {
      await assertRejects(
        () => converterEmAssinaturaAtiva(comoCliente(client), row, { creditCardToken: "tok_1" }, opts),
        Error,
        "cobrança criada (sub_asaas_1), mas falhou ao ativar a assinatura: deadlock"
      );
      assertEquals(
        ops.some((o) => o.tabela === "empresas" && o.tipo === "update"),
        false
      );
      assertEquals(
        ops.some((o) => o.tabela === "admin_audit_logs"),
        false
      );
    } finally {
      asaas.restore();
    }
  }
);

Deno.test("com admins, o recibo sai para eles (dry run aqui) e a conversão conclui", async () => {
  const { client, ops } = fakeAdmin({ plano, admins: [{ email: "dono@escritorio.com" }, { email: null }] });
  const asaas = stubAsaas(asaasOk);
  try {
    const r = await converterEmAssinaturaAtiva(comoCliente(client), row, { creditCardToken: "tok_1" }, opts);
    assertEquals(r.valor, 690);
    const consultaAdmins = ops.find((o) => o.tabela === "profiles");
    // Só admins ativos da própria empresa recebem.
    assertEquals(consultaAdmins?.filtros, [
      ["eq", "empresa_id", "e1"],
      ["in", "role", ["owner", "admin", "ultra_admin"]],
      ["is", "desativado_em", null],
    ]);
  } finally {
    asaas.restore();
  }
});

Deno.test("sem admins com e-mail, converte normalmente sem tentar mandar recibo", async () => {
  const { client } = fakeAdmin({ plano, admins: [{ email: null }] });
  const asaas = stubAsaas(asaasOk);
  try {
    const r = await converterEmAssinaturaAtiva(comoCliente(client), row, { creditCardToken: "tok_1" }, opts);
    assertEquals(r.asaasSubscriptionId, "sub_asaas_1");
    // Só a chamada de criação da assinatura foi ao "Asaas"/rede.
    assertEquals(asaas.corpos.length, 1);
  } finally {
    asaas.restore();
  }
});
