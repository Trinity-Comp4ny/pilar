import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type AcessoAuth, ultimoAcesso } from "./ultimo-acesso.ts";

Deno.test("último acesso: pega o login mais recente entre os usuários da empresa", () => {
  const acessos = new Map<string, AcessoAuth>([
    ["a", { lastSignInAt: "2026-10-01T10:00:00Z", createdAt: null }],
    ["b", { lastSignInAt: "2026-10-12T08:00:00Z", createdAt: null }],
    ["c", { lastSignInAt: null, createdAt: null }],
  ]);
  assertEquals(ultimoAcesso(["a", "b", "c"], acessos), "2026-10-12T08:00:00Z");
  assertEquals(ultimoAcesso(["c", "x"], acessos), null);
  assertEquals(ultimoAcesso([], acessos), null);
});
