import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// O DSN e o ambiente são lidos no import de sentry.ts, então precisam existir ANTES do
// import dinâmico. Valor fake: nenhuma requisição sai, o fetch abaixo é stub.
Deno.env.set("SENTRY_DSN", "https://chavepublica@o1.ingest.sentry.io/42");
Deno.env.set("SENTRY_ENV", "production");
const { conteudoGenAiPorAmbiente, recordGenAiSpan, withSentry } = await import("./sentry.ts");

const atributos = {
  "gen_ai.request.model": "gemini-2.5-flash",
  "gen_ai.usage.input_tokens": 120,
  "gen_ai.usage.output_tokens": 40,
  "pilar.empresa_id": "empresa-1",
  "gen_ai.input.messages": [{ role: "user", content: "Cliente Construtora Alfa pagou R$ 48.000" }],
  "gen_ai.output.messages": [{ role: "assistant", content: "Lançamento de R$ 48.000 criado" }],
};

const metadado = {
  "gen_ai.request.model": "gemini-2.5-flash",
  "gen_ai.usage.input_tokens": 120,
  "gen_ai.usage.output_tokens": 40,
  "pilar.empresa_id": "empresa-1",
};

Deno.test("conteudoGenAiPorAmbiente: produção e staging mandam só metadado", () => {
  assertEquals(conteudoGenAiPorAmbiente(atributos, "production"), metadado);
  assertEquals(conteudoGenAiPorAmbiente(atributos, "staging"), metadado);
});

Deno.test("conteudoGenAiPorAmbiente: ambiente vazio ou digitado errado cai no lado seguro", () => {
  assertEquals(conteudoGenAiPorAmbiente(atributos, ""), metadado);
  assertEquals(conteudoGenAiPorAmbiente(atributos, "Development"), metadado);
  assertEquals(conteudoGenAiPorAmbiente(atributos, "dev "), metadado);
});

Deno.test("conteudoGenAiPorAmbiente: dev mantém o conteúdo pro replay", () => {
  assertEquals(conteudoGenAiPorAmbiente(atributos, "development"), atributos);
  assertEquals(conteudoGenAiPorAmbiente(atributos, "local"), atributos);
});

Deno.test("withSentry em produção: o envelope do span não leva prompt nem resposta", async () => {
  const corpos: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    corpos.push(String(init?.body ?? ""));
    return Promise.resolve(new Response(null, { status: 200 }));
  }) as typeof fetch;
  try {
    const handler = withSentry("ai-chat", () => {
      recordGenAiSpan({ op: "gen_ai.chat", name: "chat", attributes: atributos, startMs: 0, endMs: 1 });
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    await handler(new Request("http://localhost/", { method: "POST" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    globalThis.fetch = original;
  }

  assertEquals(corpos.length, 1);
  assertEquals(corpos[0].includes("Construtora Alfa"), false);
  assertEquals(corpos[0].includes("gen_ai.input.messages"), false);
  assertEquals(corpos[0].includes("gen_ai.output.messages"), false);
  assertEquals(corpos[0].includes("\"gen_ai.usage.input_tokens\":120"), true);
});
