import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { respostaDeRateLimit } from "./db-rate-limit.ts";

const req = new Request("https://x.test/fn", { method: "POST" });

Deno.test("dentro do limite segue (null)", () => {
  assertEquals(respostaDeRateLimit({ allowed: true }, req), null);
});

Deno.test("estouro vira 429", () => {
  assertEquals(respostaDeRateLimit({ allowed: false }, req)?.status, 429);
});

Deno.test("erro da RPC vira 503 (fail-closed), nunca libera", () => {
  assertEquals(respostaDeRateLimit({ allowed: false, rpcError: "boom" }, req)?.status, 503);
});
