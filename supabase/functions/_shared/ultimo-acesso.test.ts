import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { type AcessoAuth, maisRecenteDe, ultimoAcesso } from "./ultimo-acesso.ts";

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

Deno.test("maisRecenteDe: sessão renovada vale mais que o login antigo", () => {
  assertEquals(maisRecenteDe("2026-10-15T03:27:16Z", "2026-10-29T20:21:37+00:00"), "2026-10-29T20:21:37+00:00");
  assertEquals(maisRecenteDe("2026-10-29T20:00:00Z", "2026-10-15T03:27:16Z"), "2026-10-29T20:00:00Z");
  assertEquals(maisRecenteDe(null, "2026-10-15T03:27:16Z"), "2026-10-15T03:27:16Z");
  assertEquals(maisRecenteDe("2026-10-15T03:27:16Z", null), "2026-10-15T03:27:16Z");
  assertEquals(maisRecenteDe(null, null), null);
});
