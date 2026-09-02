// Roda com: deno test --allow-env supabase/functions/lookup-cep
//
// Cobre o fallback BrasilAPI → ViaCEP e o caso real que já apareceu em
// produção (PILAR-2J, 02/09): um provider mudando o formato da resposta não
// pode derrubar a busca, só faz cair pro próximo provider / found:false.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { fromBrasilApi, fromViaCep } from "./providers.ts";

function stubFetch(impl: (url: string) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => impl(String(input))) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.test("fromBrasilApi retorna o endereço quando a resposta bate com o schema esperado", async () => {
  const restore = stubFetch(() =>
    jsonResponse({
      cep: "01310-100",
      city: "São Paulo",
      state: "SP",
      street: "Av. Paulista",
      neighborhood: "Bela Vista",
    })
  );
  try {
    const result = await fromBrasilApi("01310100");
    assertEquals(result, {
      cep: "01310-100",
      street: "Av. Paulista",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    });
  } finally {
    restore();
  }
});

Deno.test("fromBrasilApi retorna null (não joga erro) quando o CEP não existe (404)", async () => {
  const restore = stubFetch(() => new Response(null, { status: 404 }));
  try {
    assertEquals(await fromBrasilApi("00000000"), null);
  } finally {
    restore();
  }
});

Deno.test("fromBrasilApi retorna null, não quebra, quando o provider muda o formato da resposta", async () => {
  // Mesma classe de bug do PILAR-2J, só que no provider primário: se o shape
  // mudar, a busca precisa continuar (cair pro ViaCEP), não estourar.
  const restore = stubFetch(() => jsonResponse({ unexpected: "shape" }));
  try {
    assertEquals(await fromBrasilApi("01310100"), null);
  } finally {
    restore();
  }
});

Deno.test("fromBrasilApi lança quando o provider responde erro real (não 404)", async () => {
  const restore = stubFetch(() => new Response(null, { status: 500 }));
  try {
    let threw = false;
    try {
      await fromBrasilApi("01310100");
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
  } finally {
    restore();
  }
});

Deno.test("fromViaCep retorna o endereço quando a resposta bate com o schema esperado", async () => {
  const restore = stubFetch(() =>
    jsonResponse({
      cep: "01310-100",
      logradouro: "Av. Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
    })
  );
  try {
    const result = await fromViaCep("01310100");
    assertEquals(result, {
      cep: "01310-100",
      street: "Av. Paulista",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    });
  } finally {
    restore();
  }
});

Deno.test("fromViaCep retorna null quando o CEP não é encontrado (erro:true)", async () => {
  const restore = stubFetch(() => jsonResponse({ erro: true }));
  try {
    assertEquals(await fromViaCep("00000000"), null);
  } finally {
    restore();
  }
});

Deno.test(
  "fromViaCep retorna null (não quebra) quando o formato da resposta mudou — reprodução do PILAR-2J",
  async () => {
    const restore = stubFetch(() => jsonResponse({ cep: "01310-100" /* sem localidade/uf: schema não bate mais */ }));
    try {
      assertEquals(await fromViaCep("01310100"), null);
    } finally {
      restore();
    }
  }
);
