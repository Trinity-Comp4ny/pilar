import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { recusaDoAlvo, recusaDoAutor } from "./permissao.ts";

const adminA = { empresa_id: "empresa-a", role: "admin" };
const ultra = { empresa_id: "empresa-plataforma", role: "ultra_admin" };

Deno.test("autor: só admin ou ultra_admin com empresa remove usuário", () => {
  assertEquals(recusaDoAutor(adminA), null);
  assertEquals(recusaDoAutor(ultra), null);
  for (const role of ["user", "coordenador", "colaborador", "owner", null]) {
    assertEquals(recusaDoAutor({ empresa_id: "empresa-a", role })?.status, 403, String(role));
  }
  assertEquals(recusaDoAutor({ empresa_id: null, role: "admin" })?.error, "Empresa não encontrada");
  assertEquals(recusaDoAutor(null)?.status, 403);
});

Deno.test("admin remove usuário comum ou outro admin da própria empresa", () => {
  assertEquals(recusaDoAlvo(adminA, { empresa_id: "empresa-a", role: "user" }), null);
  assertEquals(recusaDoAlvo(adminA, { empresa_id: "empresa-a", role: "admin" }), null);
});

Deno.test("admin não remove ninguém de outra empresa", () => {
  assertEquals(recusaDoAlvo(adminA, { empresa_id: "empresa-b", role: "user" }), {
    status: 403,
    error: "Usuário não pertence à sua empresa",
  });
  assertEquals(recusaDoAlvo(adminA, { empresa_id: null, role: "user" })?.status, 403);
});

Deno.test("admin não remove ultra_admin, mesmo vinculado à empresa dele", () => {
  assertEquals(recusaDoAlvo(adminA, { empresa_id: "empresa-a", role: "ultra_admin" })?.status, 403);
});

Deno.test("ultra_admin remove em qualquer empresa", () => {
  assertEquals(recusaDoAlvo(ultra, { empresa_id: "empresa-b", role: "admin" }), null);
  assertEquals(recusaDoAlvo(ultra, { empresa_id: "empresa-b", role: "ultra_admin" }), null);
});
