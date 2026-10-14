import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerAcaoEmMassa, lerExclusaoEmpresa, lerNovaEmpresa } from "./entrada.ts";

Deno.test("empresa nova: nome obrigatório e e-mail do dono normalizado", () => {
  const r = lerNovaEmpresa({ nome: " VRZ Engenharia ", owner_email: " Dono@VRZ.com.br ", cnpj: "" });
  assertEquals(r.ok && r.data, { nome: "VRZ Engenharia", cnpj: null, ownerEmail: "dono@vrz.com.br", ownerNome: null });
  assertEquals(lerNovaEmpresa({ owner_email: "a@b.co" }), { ok: false, error: "Nome da empresa é obrigatório" });
  assertEquals(lerNovaEmpresa({ nome: "X", owner_email: "dono" }), { ok: false, error: "E-mail do dono inválido" });
  assertEquals(lerNovaEmpresa(null), { ok: false, error: "Nome da empresa é obrigatório" });
});

Deno.test("ação em massa: feature em snake_case, valor booleano e escopo conhecido", () => {
  const r = lerAcaoEmMassa({ feature: "obras_clima", value: true, scope: "has_parent", parent: "obras" });
  assertEquals(r.ok && r.data, { feature: "obras_clima", value: true, scope: "has_parent", parent: "obras" });
  assertEquals(lerAcaoEmMassa({ feature: "Obras", value: true, scope: "all" }), {
    ok: false,
    error: "feature inválida",
  });
  assertEquals(lerAcaoEmMassa({ feature: "obras", value: "true", scope: "all" }), {
    ok: false,
    error: "value deve ser boolean",
  });
  assertEquals(lerAcaoEmMassa({ feature: "obras", value: false, scope: "has_parent" }), {
    ok: false,
    error: "parent é obrigatório para scope has_parent",
  });
});

Deno.test("exclusão: empresa_id uuid, nome de confirmação e motivo obrigatórios", () => {
  const id = "4f2c9a1e-8b7d-4c3a-9e2f-1a2b3c4d5e6f";
  const r = lerExclusaoEmpresa({ empresa_id: id, confirm_name: " VRZ ", motivo: " pedido do cliente " });
  assertEquals(r.ok && r.data, { empresaId: id, confirmName: "VRZ", motivo: "pedido do cliente" });
  assertEquals(lerExclusaoEmpresa({ empresa_id: "x", confirm_name: "VRZ", motivo: "m" }), {
    ok: false,
    error: "empresa_id inválido",
  });
  assertEquals(lerExclusaoEmpresa({ empresa_id: id, confirm_name: "", motivo: "m" }), {
    ok: false,
    error: "Digite o nome da empresa para confirmar",
  });
  assertEquals(lerExclusaoEmpresa({ empresa_id: id, confirm_name: "VRZ", motivo: "  " }), {
    ok: false,
    error: "Motivo é obrigatório",
  });
});
