import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { emailDoConvite, papelSeguro } from "./entrada.ts";

Deno.test("papel pedido fora da lista cai no padrão (nunca vira ultra_admin)", () => {
  assertEquals(papelSeguro("coordenador", "user"), "coordenador");
  assertEquals(papelSeguro("ultra_admin", "user"), "user");
  assertEquals(papelSeguro(undefined, "admin"), "admin");
});

Deno.test("e-mail do convite é validado e normalizado", () => {
  assertEquals(emailDoConvite("  Ana@Escritorio.com "), { ok: true, email: "ana@escritorio.com" });
  assertEquals(emailDoConvite("ana"), { ok: false, error: "email obrigatório" });
  assertEquals(emailDoConvite(undefined), { ok: false, error: "email obrigatório" });
});
