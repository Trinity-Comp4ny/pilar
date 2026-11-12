import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { claimsDoToken, clientIdDoAppExterno } from "./app-externo.ts";

function base64url(texto: string): string {
  const binario = String.fromCharCode(...new TextEncoder().encode(texto));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bearer(claims: Record<string, unknown>): string {
  return `Bearer ${base64url('{"alg":"ES256"}')}.${base64url(JSON.stringify(claims))}.assinatura`;
}

Deno.test("token de app externo (OAuth) é reconhecido pelo client_id", () => {
  const header = bearer({ sub: "u1", role: "authenticated", client_id: "9f1c2d3e-0000-4000-8000-000000000001" });
  assertEquals(clientIdDoAppExterno(header), "9f1c2d3e-0000-4000-8000-000000000001");
});

Deno.test("sessão do app (sem client_id) não é app externo", () => {
  assertEquals(clientIdDoAppExterno(bearer({ sub: "u1", role: "authenticated", aal: "aal1" })), null);
  assertEquals(clientIdDoAppExterno(bearer({ sub: "u1", client_id: "" })), null);
  assertEquals(clientIdDoAppExterno(bearer({ sub: "u1", client_id: 123 })), null);
});

Deno.test("header ausente, sem Bearer ou malformado não quebra", () => {
  assertEquals(clientIdDoAppExterno(null), null);
  assertEquals(clientIdDoAppExterno("Basic abc"), null);
  assertEquals(clientIdDoAppExterno("Bearer só-um-pedaço"), null);
  assertEquals(claimsDoToken("Bearer a.%%%.c"), null);
  assertEquals(claimsDoToken(`Bearer a.${base64url("[1,2]")}.c`), null);
});

Deno.test("payload com acento e base64url sem padding é lido", () => {
  assertEquals(claimsDoToken(bearer({ nome: "João", client_id: "x" }))?.nome, "João");
});
