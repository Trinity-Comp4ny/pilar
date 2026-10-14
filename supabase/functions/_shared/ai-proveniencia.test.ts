import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { hashDoPrompt, proveniencia, releaseAtual } from "./ai-proveniencia.ts";

Deno.test("hashDoPrompt: 16 hex, estável para o mesmo prompt e diferente quando o prompt muda", async () => {
  const a = await hashDoPrompt("Você é o orquestrador do Pilar.");
  assertEquals(/^[0-9a-f]{16}$/.test(a), true);
  assertEquals(await hashDoPrompt("Você é o orquestrador do Pilar."), a);
  assertNotEquals(await hashDoPrompt("Você é o orquestrador do Pilar!"), a);
});

Deno.test("releaseAtual: commit do deploy, null sem RELEASE_SHA ou com valor vazio", () => {
  assertEquals(
    releaseAtual((k) => (k === "RELEASE_SHA" ? "abc123" : undefined)),
    "abc123"
  );
  assertEquals(
    releaseAtual(() => undefined),
    null
  );
  assertEquals(
    releaseAtual(() => ""),
    null
  );
});

Deno.test("proveniencia: junta release e hash do prompt", async () => {
  const p = await proveniencia("prompt", (k) => (k === "RELEASE_SHA" ? "abc123" : undefined));
  assertEquals(p.release, "abc123");
  assertEquals(p.prompt_hash, await hashDoPrompt("prompt"));
});
