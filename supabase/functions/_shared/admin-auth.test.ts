import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ehAdminDaEmpresa } from "./admin-auth.ts";

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
