import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { aalDoToken, ehAdminDaEmpresa, mfaDispensado } from "./admin-auth.ts";

Deno.test("ehAdminDaEmpresa: admin e ultra_admin com empresa passam", () => {
  assertEquals(ehAdminDaEmpresa({ empresa_id: "e1", role: "admin" }), true);
  assertEquals(ehAdminDaEmpresa({ empresa_id: "e1", role: "ultra_admin" }), true);
});

Deno.test("ehAdminDaEmpresa: qualquer outro papel, sem papel ou legado 'owner' não passa", () => {
  for (const role of ["user", "coordenador", "colaborador", "owner", "", null]) {
    assertEquals(ehAdminDaEmpresa({ empresa_id: "e1", role }), false, String(role));
  }
});

Deno.test("ehAdminDaEmpresa: admin sem empresa ou sem profile não passa", () => {
  assertEquals(ehAdminDaEmpresa({ empresa_id: null, role: "admin" }), false);
  assertEquals(ehAdminDaEmpresa({ empresa_id: "", role: "admin" }), false);
  assertEquals(ehAdminDaEmpresa(null), false);
  assertEquals(ehAdminDaEmpresa(undefined), false);
});

// JWT sintético: só o payload importa para aalDoToken (a assinatura já foi validada no Auth).
const jwt = (payload: unknown) => {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `Bearer ${b64({ alg: "HS256" })}.${b64(payload)}.assinatura`;
};

Deno.test("aalDoToken: lê aal1 e aal2 do payload", () => {
  assertEquals(aalDoToken(jwt({ aal: "aal2" })), "aal2");
  assertEquals(aalDoToken(jwt({ aal: "aal1" })), "aal1");
});

Deno.test("aalDoToken: sem claim, token malformado ou header ausente devolve null", () => {
  assertEquals(aalDoToken(jwt({ sub: "u1" })), null);
  assertEquals(aalDoToken(jwt({ aal: 2 })), null);
  assertEquals(aalDoToken("Bearer nao-e-jwt"), null);
  assertEquals(aalDoToken("Bearer a.%%%.c"), null);
  assertEquals(aalDoToken(""), null);
  assertEquals(aalDoToken(null), null);
});

Deno.test("mfaDispensado: só false explícito dispensa o segundo fator", () => {
  assertEquals(mfaDispensado(false), true);
  for (const v of [true, null, undefined]) assertEquals(mfaDispensado(v), false, String(v));
});
