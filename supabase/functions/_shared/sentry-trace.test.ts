import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// O DSN é lido no import de sentry.ts, então precisa existir ANTES do import dinâmico.
// Valor fake: nenhuma requisição sai, o fetch abaixo é stub.
Deno.env.set("SENTRY_DSN", "https://chavepublica@o1.ingest.sentry.io/42");
Deno.env.set("SENTRY_ENV", "test");
Deno.env.set("SENTRY_TRACES_RATE", "0");
const { captureException, lerSentryTrace, withSentry } = await import("./sentry.ts");

const TRACE = "0123456789abcdef0123456789abcdef";
const SPAN = "fedcba9876543210";

/** Roda `fn` com fetch trocado por um stub que guarda o corpo de cada envelope. */
async function capturandoEnvelopes(fn: () => Promise<unknown>): Promise<Array<Record<string, unknown>>> {
  const corpos: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    corpos.push(String(init?.body ?? ""));
    return Promise.resolve(new Response(null, { status: 200 }));
  }) as typeof fetch;
  try {
    await fn();
    // sendTransaction é fire-and-forget: dá uma volta no event loop pra ele rodar.
    await new Promise((r) => setTimeout(r, 0));
  } finally {
    globalThis.fetch = original;
  }
  return corpos.map((c) => JSON.parse(c.split("\n")[2]));
}

Deno.test("lerSentryTrace: formato do SDK, com e sem decisão de amostragem", () => {
  assertEquals(lerSentryTrace(`${TRACE}-${SPAN}-1`), { traceId: TRACE, parentSpanId: SPAN, sampled: true });
  assertEquals(lerSentryTrace(`${TRACE}-${SPAN}-0`), { traceId: TRACE, parentSpanId: SPAN, sampled: false });
  assertEquals(lerSentryTrace(`${TRACE}-${SPAN}`), { traceId: TRACE, parentSpanId: SPAN, sampled: undefined });
  assertEquals(lerSentryTrace(null), null);
  assertEquals(lerSentryTrace("lixo"), null);
});

Deno.test("withSentry: header amostrado do browser vira filho do mesmo trace, mesmo com taxa 0", async () => {
  const handler = withSentry("teste", () => Promise.resolve(new Response("{}", { status: 200 })));
  const req = new Request("http://localhost/", { headers: { "sentry-trace": `${TRACE}-${SPAN}-1` } });
  const [tx] = await capturandoEnvelopes(() => handler(req));
  const trace = (tx.contexts as { trace: Record<string, string> }).trace;
  assertEquals(tx.type, "transaction");
  assertEquals(trace.trace_id, TRACE);
  assertEquals(trace.parent_span_id, SPAN);
});

Deno.test("withSentry: browser decidiu não amostrar, a edge também não manda", async () => {
  const handler = withSentry("teste", () => Promise.resolve(new Response("{}", { status: 200 })));
  const req = new Request("http://localhost/", { headers: { "sentry-trace": `${TRACE}-${SPAN}-0` } });
  assertEquals(await capturandoEnvelopes(() => handler(req)), []);
});

Deno.test("withSentry: erro capturado dentro do handler cai no trace da invocação", async () => {
  const handler = withSentry("teste", async () => {
    await captureException(new Error("falhou"), { fn: "teste" });
    return new Response("{}", { status: 200 });
  });
  const req = new Request("http://localhost/", { headers: { "sentry-trace": `${TRACE}-${SPAN}-0` } });
  const [erro] = await capturandoEnvelopes(() => handler(req));
  assertEquals((erro.contexts as { trace: { trace_id: string } }).trace.trace_id, TRACE);
});

Deno.test("captureException: objeto de erro do supabase-js não vira [object Object] (PILAR-30)", async () => {
  const [evento] = await capturandoEnvelopes(() =>
    captureException({ message: "permission denied for table escopos", code: "42501" })
  );
  const valor = (evento.exception as { values: Array<{ type: string; value: string }> }).values[0];
  assertEquals(valor.type, "NonError");
  assertEquals(valor.value, "permission denied for table escopos (42501)");
});
