import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// O DSN é lido no import de sentry.ts, então precisa existir ANTES do import dinâmico.
// Valor fake: nenhuma requisição sai, o fetch abaixo é stub.
Deno.env.set("SENTRY_DSN", "https://chavepublica@o1.ingest.sentry.io/42");
Deno.env.set("SENTRY_ENV", "test");
const { withCronMonitor } = await import("./sentry.ts");

/** Roda `fn` com fetch trocado por um stub que só anota a URL do check-in. */
async function capturandoCheckins(fn: () => Promise<unknown>): Promise<string[]> {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    urls.push(String(input));
    return Promise.resolve(new Response(null, { status: 202 }));
  }) as typeof fetch;
  try {
    await fn().catch(() => {});
  } finally {
    globalThis.fetch = original;
  }
  return urls.filter((u) => u.includes("/cron/"));
}

const req = new Request("http://localhost/", { method: "POST" });

Deno.test("withCronMonitor: resposta 2xx faz check-in ok no slug do job", async () => {
  const handler = withCronMonitor("trial-expiry-daily", () => Promise.resolve(new Response("{}", { status: 200 })));
  const urls = await capturandoCheckins(() => handler(req));
  assertEquals(urls.length, 1);
  assertEquals(urls[0].includes("/cron/trial-expiry-daily/"), true);
  assertEquals(urls[0].includes("status=ok"), true);
});

Deno.test("withCronMonitor: resposta 5xx faz check-in error", async () => {
  const handler = withCronMonitor("trial-expiry-daily", () => Promise.resolve(new Response("x", { status: 500 })));
  const urls = await capturandoCheckins(() => handler(req));
  assertEquals(urls.length, 1);
  assertEquals(urls[0].includes("status=error"), true);
});

Deno.test("withCronMonitor: exceção faz check-in error e é repassada", async () => {
  const handler = withCronMonitor("trial-expiry-daily", () => Promise.reject(new Error("boom")));
  const urls = await capturandoCheckins(() => assertRejects(() => handler(req), Error, "boom"));
  assertEquals(urls.length, 1);
  assertEquals(urls[0].includes("status=error"), true);
});

Deno.test("withCronMonitor: chamada sem o segredo do cron (401/405) não conta como execução", async () => {
  for (const status of [401, 403, 405]) {
    const handler = withCronMonitor("trial-expiry-daily", () => Promise.resolve(new Response("", { status })));
    const urls = await capturandoCheckins(() => handler(req));
    assertEquals(urls, [], `status ${status} não deveria fazer check-in`);
  }
});
