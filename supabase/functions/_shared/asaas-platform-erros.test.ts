// Contrato de erro e de rota do cliente Asaas da plataforma: o que sobe para quem
// chama quando o Asaas recusa, cai ou responde fora do formato, e o path/método de
// cada operação de assinatura (um erro aqui só apareceria contra o Asaas real).

import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("ASAAS_PLATFORM_API_KEY", "test-key");
Deno.env.set("ASAAS_PLATFORM_ENV", "sandbox");

const {
  cancelSubscription,
  createCustomer,
  createPayment,
  findCustomerByCpfCnpj,
  getPlatformConfig,
  getRecentSubscriptionPayments,
  getSubscription,
  getSubscriptionPayments,
  updateSubscription,
} = await import("./asaas-platform.ts");

type Chamada = { url: string; method: string; headers: Record<string, string>; body: unknown };

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const chamadas: Chamada[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    chamadas.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return impl(String(input), init);
  }) as typeof fetch;
  return {
    chamadas,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function comEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  return async () => {
    const antes: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(vars)) {
      antes[k] = Deno.env.get(k);
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    try {
      await fn();
    } finally {
      for (const [k, v] of Object.entries(antes)) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
    }
  };
}

// --- Configuração ---

Deno.test(
  "sem chave da API a chamada falha antes de ir à rede",
  comEnv({ ASAAS_PLATFORM_API_KEY: undefined }, async () => {
    const f = stubFetch(() => json({}));
    try {
      await assertRejects(() => getSubscription("sub_1"), Error, "ASAAS_PLATFORM_API_KEY não configurada");
      assertEquals(f.chamadas.length, 0);
    } finally {
      f.restore();
    }
  })
);

Deno.test(
  "ambiente desconhecido é recusado (não cai em produção por engano)",
  comEnv({ ASAAS_PLATFORM_ENV: "prod" }, () => {
    let erro = "";
    try {
      getPlatformConfig();
    } catch (e) {
      erro = (e as Error).message;
    }
    assertEquals(erro, "ASAAS_PLATFORM_ENV inválido: prod");
  })
);

Deno.test(
  "sem ambiente definido usa sandbox; producao usa a API real",
  comEnv({ ASAAS_PLATFORM_ENV: undefined }, () => {
    assertEquals(getPlatformConfig().baseUrl, "https://sandbox.asaas.com/api/v3");
    Deno.env.set("ASAAS_PLATFORM_ENV", "producao");
    assertEquals(getPlatformConfig().baseUrl, "https://api.asaas.com/v3");
  })
);

Deno.test("a chave vai no header access_token, nunca na URL", async () => {
  const f = stubFetch(() => json({ id: "sub_1" }));
  try {
    await getSubscription("sub_1");
    assertEquals(f.chamadas[0].headers.access_token, "test-key");
    assertEquals(f.chamadas[0].url.includes("test-key"), false);
  } finally {
    f.restore();
  }
});

// --- Erros do Asaas ---

Deno.test("erro do Asaas com descrição sobe a 1ª descrição com prefixo", async () => {
  const f = stubFetch(() =>
    json({ errors: [{ description: "Transação não autorizada." }, { description: "outra" }] }, 400)
  );
  try {
    await assertRejects(() => updateSubscription("sub_1", { value: 690 }), Error, "Asaas: Transação não autorizada.");
  } finally {
    f.restore();
  }
});

Deno.test("erro do Asaas sem corpo JSON (502 do gateway) vira 'Asaas <status>'", async () => {
  const f = stubFetch(() => new Response("<html>Bad Gateway</html>", { status: 502 }));
  try {
    await assertRejects(() => cancelSubscription("sub_1"), Error, "Asaas: Asaas 502");
  } finally {
    f.restore();
  }
});

Deno.test("erro do Asaas com corpo vazio ou lista de erros vazia também vira 'Asaas <status>'", async () => {
  let f = stubFetch(() => new Response("", { status: 401 }));
  try {
    await assertRejects(() => getSubscription("sub_1"), Error, "Asaas: Asaas 401");
  } finally {
    f.restore();
  }
  f = stubFetch(() => json({ errors: [] }, 404));
  try {
    await assertRejects(() => getSubscription("sub_1"), Error, "Asaas: Asaas 404");
  } finally {
    f.restore();
  }
});

Deno.test("falha de rede (Asaas fora do ar) propaga o erro para quem chama decidir", async () => {
  const f = stubFetch(() => Promise.reject(new TypeError("error sending request")));
  try {
    await assertRejects(
      () => createPayment({ customer: "cus_1", billingType: "PIX", value: 49, dueDate: "2026-11-07" }),
      TypeError,
      "error sending request"
    );
  } finally {
    f.restore();
  }
});

// --- Rotas das operações de assinatura ---

Deno.test("cancelar assinatura é DELETE em /subscriptions/:id", async () => {
  const f = stubFetch(() => json({ deleted: true, id: "sub_1" }));
  try {
    const r = await cancelSubscription("sub_1");
    assertEquals(f.chamadas[0].method, "DELETE");
    assertEquals(f.chamadas[0].url, "https://sandbox.asaas.com/api/v3/subscriptions/sub_1");
    assertEquals(r.deleted, true);
  } finally {
    f.restore();
  }
});

Deno.test("trocar plano é POST em /subscriptions/:id com o corpo recebido", async () => {
  const f = stubFetch(() => json({ id: "sub_1" }));
  try {
    await updateSubscription("sub_1", { value: 6900, cycle: "YEARLY", updatePendingPayments: true });
    assertEquals(f.chamadas[0].method, "POST");
    assertEquals(f.chamadas[0].url, "https://sandbox.asaas.com/api/v3/subscriptions/sub_1");
    assertEquals(f.chamadas[0].body, { value: 6900, cycle: "YEARLY", updatePendingPayments: true });
  } finally {
    f.restore();
  }
});

Deno.test(
  "1ª cobrança vem em ordem crescente; recentes em ordem decrescente; data ausente vira lista vazia",
  async () => {
    const f = stubFetch(() => json({}));
    try {
      assertEquals(await getSubscriptionPayments("sub_1"), []);
      assertEquals(await getRecentSubscriptionPayments("sub_1"), []);
      assertEquals(
        f.chamadas[0].url,
        "https://sandbox.asaas.com/api/v3/subscriptions/sub_1/payments?limit=1&sort=dueDate&order=asc"
      );
      assertEquals(
        f.chamadas[1].url,
        "https://sandbox.asaas.com/api/v3/subscriptions/sub_1/payments?limit=5&sort=dueDate&order=desc"
      );
    } finally {
      f.restore();
    }
  }
);

// --- Clientes ---

Deno.test("busca de cliente usa só os dígitos do CPF/CNPJ e devolve null quando não acha", async () => {
  const f = stubFetch(() => json({ data: [] }));
  try {
    assertEquals(await findCustomerByCpfCnpj("12.345.678/0001-95"), null);
    assertEquals(f.chamadas[0].url, "https://sandbox.asaas.com/api/v3/customers?cpfCnpj=12345678000195&limit=1");
  } finally {
    f.restore();
  }
});

Deno.test("busca de cliente sem nenhum dígito não chama o Asaas", async () => {
  const f = stubFetch(() => json({ data: [{ id: "cus_qualquer" }] }));
  try {
    assertEquals(await findCustomerByCpfCnpj("---"), null);
    assertEquals(await findCustomerByCpfCnpj(""), null);
    assertEquals(f.chamadas.length, 0);
  } finally {
    f.restore();
  }
});

Deno.test("criar cliente manda CPF e telefone só com dígitos e omite campos vazios", async () => {
  const f = stubFetch(() => json({ id: "cus_1", name: "Ana" }));
  try {
    await createCustomer({ name: "Ana", email: "ana@x.com", cpfCnpj: "123.456.789-09", phone: "(11) 98765-4321" });
    assertEquals(f.chamadas[0].body, {
      name: "Ana",
      email: "ana@x.com",
      cpfCnpj: "12345678909",
      phone: "11987654321",
      notificationDisabled: false,
    });
    await createCustomer({ name: "Ana", email: "ana@x.com", cpfCnpj: "12345678909", externalReference: "e1" });
    const corpo = f.chamadas[1].body as Record<string, unknown>;
    assertEquals("phone" in corpo, false);
    assertEquals(corpo.externalReference, "e1");
  } finally {
    f.restore();
  }
});
