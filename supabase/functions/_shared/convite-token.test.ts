import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { gerarConviteToken } from "./convite-token.ts";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("token tem 32 bytes em hex e o hash é o SHA-256 dele (o banco só guarda o hash)", async () => {
  const { token, hash } = await gerarConviteToken();
  assertEquals(/^[0-9a-f]{64}$/.test(token), true);
  assertEquals(hash, await sha256Hex(token));
  assertNotEquals(hash, token);
});

Deno.test("dois convites nunca saem com o mesmo token", async () => {
  const tokens = new Set<string>();
  for (let i = 0; i < 50; i++) tokens.add((await gerarConviteToken()).token);
  assertEquals(tokens.size, 50);
});
