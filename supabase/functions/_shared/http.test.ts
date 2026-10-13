import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { fetchComTempo } from "./http.ts";

// fetch falso que só termina quando o signal aborta (provedor travado).
const travado = (_: string | URL | Request, init?: RequestInit) =>
  new Promise<Response>((_, rejeita) => {
    init?.signal?.addEventListener("abort", () => rejeita(init.signal!.reason));
  });

Deno.test("provedor travado falha no tempo limite com TimeoutError", async () => {
  const inicio = Date.now();
  const erro = await assertRejects(() => fetchComTempo("https://x", {}, 50, travado));
  assertEquals((erro as DOMException).name, "TimeoutError");
  assertEquals(Date.now() - inicio < 1000, true);
});

Deno.test("resposta dentro do prazo passa intacta", async () => {
  const ok = () => Promise.resolve(new Response("ok", { status: 201 }));
  const res = await fetchComTempo("https://x", {}, 1000, ok);
  assertEquals([res.status, await res.text()], [201, "ok"]);
});

Deno.test("signal do chamador continua valendo", async () => {
  const controle = new AbortController();
  const p = fetchComTempo("https://x", { signal: controle.signal }, 10_000, travado);
  controle.abort(new Error("cancelado pelo chamador"));
  const erro = await assertRejects(() => p);
  assertEquals((erro as Error).message, "cancelado pelo chamador");
});
